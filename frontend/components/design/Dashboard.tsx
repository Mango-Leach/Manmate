'use client';
import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { Icon, Avatar, Pill, GlobalHeader, type UserInfo } from './primitives';
import { io } from 'socket.io-client';
import { getToken, getCurrentUser } from '@/lib/api';
import { getFavorites, removeFavorite, type Favorite } from '@/lib/favorites';

function getSocketUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (raw.startsWith('http')) return raw;
  if (!raw.includes('.')) return `https://${raw}.onrender.com`;
  return raw.includes('localhost') || raw.includes('127.0.0.1') ? `http://${raw}` : `https://${raw}`;
}

// Mood levels 0..4 — must match the order of `moods`/`labels` in DashGreeting
// and the backend (0 Great … 4 Struggling).
const MOOD_LABELS = ['Great', 'Good', 'Okay', 'Low', 'Struggling'];
const MOOD_COLORS = ['#3F9168', '#7FB89B', '#E3B341', '#D98E5A', '#C2604D'];

// Local-time 'YYYY-MM-DD' for a given Date (matches the backend's day key).
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const DASH_STYLES = `
  @keyframes cardReveal {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmerSlide {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  @keyframes ringExpand {
    0%   { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes breathe {
    0%, 100% { transform: translateY(0) scale(1); }
    50%       { transform: translateY(-8px) scale(1.07); }
  }
  @keyframes moodDotIn {
    from { opacity: 0.08; transform: scale(0.65); }
    to   { opacity: 0.4;  transform: scale(1); }
  }
  @keyframes moodDotFill {
    from { opacity: 0.08; transform: scale(0.65); }
    to   { opacity: 1;    transform: scale(1); }
  }
`;

function useCountUp(target: number | null, duration = 950): number {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (target === null) return;
    let rafId: number;
    let start: number | null = null;
    rafId = requestAnimationFrame(function tick(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * eased));
      if (p < 1) rafId = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return val;
}

export function Dashboard({ user }: { user: UserInfo }) {
  // Bumped whenever a mood is logged so MoodStreak re-fetches its 14-day history.
  const [moodVersion, setMoodVersion] = React.useState(0);
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <style>{DASH_STYLES}</style>
      <GlobalHeader user={user} />
      <div className="dash-pad">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ animation: 'cardReveal 0.6s ease both' }}>
            <DashGreeting user={user} onMoodLogged={() => setMoodVersion(v => v + 1)} />
          </div>
          <div className="g2w" style={{ marginTop: 32 }}>
            <div style={{ animation: 'cardReveal 0.6s ease 0.1s both' }}>
              <QuickActions />
            </div>
            <div style={{ animation: 'cardReveal 0.6s ease 0.2s both' }}>
              <WalletCard user={user} />
            </div>
          </div>
          <div className="g2w" style={{ marginTop: 20 }}>
            <div style={{ animation: 'cardReveal 0.6s ease 0.3s both' }}>
              <UpcomingSessions />
            </div>
            <div style={{ animation: 'cardReveal 0.6s ease 0.38s both' }}>
              <MoodStreak refreshKey={moodVersion} />
            </div>
          </div>
          <div style={{ animation: 'cardReveal 0.6s ease 0.46s both' }}>
            <FavoritesCard />
          </div>
          <div style={{ animation: 'cardReveal 0.6s ease 0.54s both' }}>
            <PastActivity />
          </div>
        </div>
      </div>
    </div>
  );
}

function DashGreeting({ user, onMoodLogged }: { user: UserInfo; onMoodLogged?: () => void }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const [selected, setSelected] = React.useState<number | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const btnRefs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const confirmTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const moods = ['😌', '🙂', '😐', '😟', '😢'];
  const labels = MOOD_LABELS;

  // Pre-select today's mood if it was already logged.
  React.useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${getSocketUrl()}/api/moods?days=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => {
        const todayKey = toDateKey(new Date());
        const today = res?.data?.entries?.find((e: { dateKey: string }) => e.dateKey === todayKey);
        if (today && typeof today.level === 'number') setSelected(today.level);
      })
      .catch(() => {});
  }, []);

  async function persistMood(level: number) {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`${getSocketUrl()}/api/moods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ level }),
      });
      const data = await res.json();
      if (data.success) onMoodLogged?.();
    } catch {
      /* non-blocking: mood is still reflected locally */
    }
  }

  function handleMoodClick(i: number) {
    setSelected(i);
    void persistMood(i);
    const btn = btnRefs.current[i];
    if (btn) {
      btn.style.animation = 'none';
      void btn.offsetHeight;
      btn.style.animation = 'moodPop 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both';
      setTimeout(() => { if (btn) btn.style.animation = ''; }, 520);
    }
    setShowConfirm(false);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    confirmTimer.current = setTimeout(() => setShowConfirm(true), 380);
    hideTimer.current = setTimeout(() => setShowConfirm(false), 2800);
  }

  return (
    <>
      <style>{`
        @keyframes moodPop {
          0%   { transform: scale(1) rotate(0deg); }
          20%  { transform: scale(1.45) rotate(-8deg); }
          45%  { transform: scale(0.82) rotate(6deg); }
          65%  { transform: scale(1.18) rotate(-3deg); }
          80%  { transform: scale(0.95) rotate(1deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes moodFadeUp {
          0%   { opacity: 0; transform: translateY(6px); }
          18%  { opacity: 1; transform: translateY(0); }
          72%  { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-3px); }
        }
      `}</style>
      <div className="dash-greet">
        <div>
          <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>{greet}, {user.name.split(' ')[0]}.</div>
          <h1 className="serif" style={{ fontSize: 'clamp(28px, 5vw, 52px)', margin: 0, fontWeight: 400, letterSpacing: -0.015, lineHeight: 1.05 }}>
            How are you feeling <em style={{ fontStyle: 'italic', color: 'var(--sage)' }}>right now</em>?
          </h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {moods.map((e, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <button
                  ref={el => { btnRefs.current[i] = el; }}
                  onClick={() => handleMoodClick(i)}
                  title={labels[i]}
                  style={{
                    width: 48, height: 48, borderRadius: 14,
                    border: selected === i ? '2px solid var(--sage)' : '1px solid var(--line)',
                    background: selected === i ? 'var(--sage-soft)' : 'var(--card)',
                    cursor: 'pointer', fontSize: 22,
                    transition: 'border-color 0.2s, background 0.2s, transform 0.15s',
                  }}
                  onMouseEnter={ev => { ev.currentTarget.style.transform = 'scale(1.1) translateY(-2px)'; }}
                  onMouseLeave={ev => { ev.currentTarget.style.transform = ''; }}
                >{e}</button>
                <span style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: 0.3,
                  color: selected === i ? 'var(--sage)' : 'transparent',
                  transition: 'color 0.2s',
                  userSelect: 'none',
                }}>{labels[i]}</span>
              </div>
            ))}
          </div>
          <div style={{ height: 20, display: 'flex', alignItems: 'center' }}>
            {showConfirm && selected !== null && (
              <div style={{
                fontSize: 12, color: 'var(--sage)', fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 4,
                animation: 'moodFadeUp 2.4s ease both',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Feeling {labels[selected].toLowerCase()} — noted
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function QuickActions() {
  const router = useRouter();
  const [listenersOnline, setListenersOnline] = React.useState<number | null>(null);
  const [showMethodPicker, setShowMethodPicker] = React.useState(false);
  const [showPeerMethodPicker, setShowPeerMethodPicker] = React.useState(false);
  const [showConsent, setShowConsent] = React.useState(false);
  const [showPeerConsent, setShowPeerConsent] = React.useState(false);

  React.useEffect(() => {
    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnection: false });
    socket.on('connect', () => socket.emit('get-queue-stats'));
    socket.on('queue-update', (s: { listenersWaiting?: number; onlineUsers?: number }) => {
      setListenersOnline(s.listenersWaiting ?? s.onlineUsers ?? 0);
      socket.disconnect();
    });
    socket.on('online-success', (d: { stats: { listenersWaiting?: number } }) => {
      setListenersOnline(d.stats.listenersWaiting ?? 0);
      socket.disconnect();
    });
    return () => { socket.disconnect(); };
  }, []);

  const listenerSub = listenersOnline === null
    ? 'Checking availability…'
    : listenersOnline > 0
      ? `${listenersOnline} trained volunteer${listenersOnline !== 1 ? 's' : ''} available · free & confidential`
      : 'No listeners available right now · check back soon';

  function handleListenerMethodSelect(method: 'call' | 'chat') {
    setShowMethodPicker(false);
    if (method === 'call') {
      const already = sessionStorage.getItem('listener_consent_v1');
      if (already === 'accepted') { router.push('/peer-call'); return; }
      setShowConsent(true);
    } else {
      router.push('/chat');
    }
  }

  function handlePeerMethodSelect(method: 'call' | 'chat') {
    setShowPeerMethodPicker(false);
    if (method === 'call') {
      const already = sessionStorage.getItem('peer_consent_v1');
      if (already === 'accepted') { router.push('/peer-call?mode=peer'); return; }
      setShowPeerConsent(true);
    } else {
      router.push('/chat?mode=peer');
    }
  }

  function handleActionClick(id: string) {
    if (id === 'listener') {
      setShowMethodPicker(true);
    } else if (id === 'peer') {
      setShowPeerMethodPicker(true);
    } else {
      router.push(id);
    }
  }

  const peerIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  );

  const actions = [
    { id: '/ai-call', icon: Icon.sparkle(20), title: 'Find Calm with Serenity', sub: 'Your AI companion · compassionate support, always available', tone: 'sage' },
    { id: 'listener', icon: Icon.users(20), title: 'Connect with a Listener', sub: listenerSub, tone: 'lavender' },
    { id: 'peer', icon: peerIcon, title: 'Connect with a Peer', sub: 'Peer-to-peer support · with someone going through it too', tone: 'peach' },
    { id: '/therapists', icon: Icon.calendar(20), title: 'Find Your Therapist', sub: 'Browse verified, licensed professionals · book in minutes', tone: 'peach' },
  ];
  return (
    <>
      <div
        style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(31,42,36,0.10)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
      >
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>
          Quick actions
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {actions.map((a, idx) => (
            <button key={a.id} onClick={() => handleActionClick(a.id)} style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '16px 18px', borderRadius: 14,
              border: '1px solid var(--line-2)', background: 'var(--bg)',
              cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--sage-soft)'; e.currentTarget.style.background = 'var(--bg-2)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg)'; }}
            >
              <div style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: a.tone === 'sage' ? 'var(--sage-soft)' : a.tone === 'lavender' ? 'var(--lavender-soft)' : 'var(--peach)',
                  color: a.tone === 'sage' ? 'var(--sage)' : a.tone === 'lavender' ? 'var(--lavender)' : 'var(--ink-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{a.icon}</div>
                {idx < 2 && (
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: 12,
                    border: `1.5px solid ${a.tone === 'sage' ? 'var(--sage)' : 'var(--lavender)'}`,
                    animation: `ringExpand 2.6s ease-out ${idx === 0 ? '0s' : '1.0s'} infinite`,
                    pointerEvents: 'none',
                  }} />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>{a.title}</div>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>{a.sub}</div>
              </div>
              {Icon.arrow(16)}
            </button>
          ))}
        </div>
      </div>

      {showMethodPicker && (
        <ListenerMethodModal
          listenersOnline={listenersOnline}
          onSelect={handleListenerMethodSelect}
          onClose={() => setShowMethodPicker(false)}
        />
      )}

      {showPeerMethodPicker && (
        <PeerMethodModal
          onSelect={handlePeerMethodSelect}
          onClose={() => setShowPeerMethodPicker(false)}
        />
      )}

      {showConsent && (
        <ListenerConsentModal
          onAccept={() => {
            sessionStorage.setItem('listener_consent_v1', 'accepted');
            setShowConsent(false);
            router.push('/peer-call');
          }}
          onClose={() => setShowConsent(false)}
        />
      )}

      {showPeerConsent && (
        <PeerConsentModal
          onAccept={() => {
            sessionStorage.setItem('peer_consent_v1', 'accepted');
            setShowPeerConsent(false);
            router.push('/peer-call?mode=peer');
          }}
          onClose={() => setShowPeerConsent(false)}
        />
      )}
    </>
  );
}

// ── Listener Method Picker Modal ────────────────────────────────────────────────

function ListenerMethodModal({
  listenersOnline,
  onSelect,
  onClose,
}: {
  listenersOnline: number | null;
  onSelect: (method: 'call' | 'chat') => void;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;

  const availText = listenersOnline === null
    ? 'Checking availability…'
    : listenersOnline > 0
      ? `${listenersOnline} trained volunteer${listenersOnline !== 1 ? 's' : ''} available`
      : 'No listeners available right now';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.55)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 440,
        border: '1px solid var(--line)',
        boxShadow: '0 32px 64px rgba(15,20,17,0.18)',
        animation: 'fadeUp 0.25s ease both',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '4px 12px', borderRadius: 999,
              background: 'var(--lavender-soft)', color: 'var(--lavender)',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              {availText}
            </div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 400, lineHeight: 1.2 }}>
              How would you like to connect?
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
              Choose how you&apos;d like to reach a trained volunteer listener — both are free and confidential.
            </div>
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--card)',
            cursor: 'pointer', color: 'var(--muted)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Options */}
        <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => onSelect('call')} style={{
            display: 'flex', alignItems: 'center', gap: 18,
            padding: '20px 20px', borderRadius: 16,
            border: '1.5px solid var(--lavender-soft)', background: 'var(--lavender-soft)',
            cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lavender)'; e.currentTarget.style.background = 'rgba(107,91,149,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--lavender-soft)'; e.currentTarget.style.background = 'var(--lavender-soft)'; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'var(--lavender)', color: '#FBF8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500, marginBottom: 3 }}>Voice call</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Speak directly with a trained volunteer · anonymous &amp; encrypted</div>
            </div>
            {Icon.arrow(16)}
          </button>

          <button onClick={() => onSelect('chat')} style={{
            display: 'flex', alignItems: 'center', gap: 18,
            padding: '20px 20px', borderRadius: 16,
            border: '1.5px solid var(--line-2)', background: 'var(--bg)',
            cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lavender)'; e.currentTarget.style.background = 'var(--lavender-soft)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg)'; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'var(--bg-2)', color: 'var(--lavender)',
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500, marginBottom: 3 }}>Text chat</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Private text support · no pressure, no rush, fully anonymous</div>
            </div>
            {Icon.arrow(16)}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>,
    document.body
  );
}

// ── Peer Method Picker Modal ────────────────────────────────────────────────────

function PeerMethodModal({
  onSelect,
  onClose,
}: {
  onSelect: (method: 'call' | 'chat') => void;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.55)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 440,
        border: '1px solid var(--line)',
        boxShadow: '0 32px 64px rgba(15,20,17,0.18)',
        animation: 'fadeUp 0.25s ease both',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 28px 20px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '4px 12px', borderRadius: 999,
              background: 'var(--peach)', color: 'var(--ink-2)',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              Peer support
            </div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 400, lineHeight: 1.2 }}>
              How would you like to connect?
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
              Connect with another user who understands what you&apos;re going through — voice or text, always anonymous.
            </div>
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--card)',
            cursor: 'pointer', color: 'var(--muted)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Options */}
        <div style={{ padding: '20px 28px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => onSelect('call')} style={{
            display: 'flex', alignItems: 'center', gap: 18,
            padding: '20px 20px', borderRadius: 16,
            border: '1.5px solid var(--peach)', background: 'var(--peach)',
            cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(185,155,120,0.5)'; e.currentTarget.style.background = 'rgba(185,155,120,0.2)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--peach)'; e.currentTarget.style.background = 'var(--peach)'; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'rgba(185,155,120,0.35)', color: 'var(--ink)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500, marginBottom: 3 }}>Voice call</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Talk with a peer in real time · encrypted &amp; anonymous</div>
            </div>
            {Icon.arrow(16)}
          </button>

          <button onClick={() => onSelect('chat')} style={{
            display: 'flex', alignItems: 'center', gap: 18,
            padding: '20px 20px', borderRadius: 16,
            border: '1.5px solid var(--line-2)', background: 'var(--bg)',
            cursor: 'pointer', textAlign: 'left', color: 'var(--ink)',
            transition: 'all 0.2s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(185,155,120,0.5)'; e.currentTarget.style.background = 'var(--peach)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line-2)'; e.currentTarget.style.background = 'var(--bg)'; }}
          >
            <div style={{
              width: 48, height: 48, borderRadius: 14, flexShrink: 0,
              background: 'var(--bg-2)', color: 'var(--ink-2)',
              border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 500, marginBottom: 3 }}>Text chat</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Chat with a peer at your own pace · no pressure</div>
            </div>
            {Icon.arrow(16)}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>,
    document.body
  );
}

// ── Listener Consent Modal ──────────────────────────────────────────────────────

const CONSENT_TERMS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Respectful communication',
    body: 'Abusive, offensive, threatening, or discriminatory language is strictly prohibited. Violations result in immediate call termination and may lead to account suspension.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: 'Session recording & data use',
    body: 'Sessions may be monitored or recorded for safety, quality assurance, and AI model training and evaluation purposes. By proceeding you consent to this data processing.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/>
      </svg>
    ),
    title: 'Not a crisis or emergency service',
    body: 'This platform is not a substitute for professional mental health care or emergency services. If you are in immediate danger, please call 112 or your local emergency number right now.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    title: 'Age requirement',
    body: 'You must be 18 years of age or older to use peer listening sessions, or have the explicit written consent of a parent or legal guardian.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
    title: 'Protect your privacy',
    body: 'Do not share personally identifying information such as your home address, phone number, or financial details during a call. All calls are anonymous by design.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
    title: 'Respect your listener',
    body: 'Listeners are volunteers who give their time to support you. Treat them with dignity, end calls gracefully, and do not attempt to contact them outside of this platform.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
    title: 'Content policy',
    body: 'Sexual, violent, illegal, or otherwise harmful content is not permitted. This includes solicitation, harassment, or any attempt to exploit another user.',
  },
];

function ListenerConsentModal({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = React.useState(false);

  // Portal to document.body so the fixed overlay is never trapped inside a
  // parent stacking context created by CSS animations (transform: translateY).
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.55)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', zIndex: 9999,
      padding: 'clamp(12px,4vw,24px) 16px', overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="consent-modal" style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--line)',
        boxShadow: '0 32px 64px rgba(15,20,17,0.18)',
        animation: 'fadeUp 0.25s ease both',
      }}>

        {/* Header */}
        <div className="consent-modal-hdr" style={{
          padding: '24px 28px 18px', flexShrink: 0,
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '4px 12px', borderRadius: 999,
              background: 'var(--lavender-soft)', color: 'var(--lavender)',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              Before you begin
            </div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 400, lineHeight: 1.2 }}>
              Person-to-person connection terms
            </div>
            <div className="consent-modal-desc" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
              These terms govern your real-time peer listening session — a direct, anonymous, encrypted connection between you and a volunteer listener. Please read before proceeding.
            </div>
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--card)',
            cursor: 'pointer', color: 'var(--muted)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* P2P connection info banner */}
        <div className="consent-modal-banner" style={{
          margin: '14px 28px 0',
          background: 'rgba(107,91,149,0.07)',
          border: '1px solid rgba(107,91,149,0.18)',
          borderRadius: 12, padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          {/* two-person icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--lavender)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--lavender)', marginBottom: 2 }}>
              Person-to-Person (P2P) Connection
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              You are connecting directly and anonymously with a real volunteer listener over an end-to-end encrypted WebRTC audio channel. Your listener sees only your display name — not your real name or personal details.
            </div>
          </div>
        </div>

        {/* Scrollable terms list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 28px 4px' }}>
          {CONSENT_TERMS.map((t, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, padding: '14px 0',
              borderBottom: i < CONSENT_TERMS.length - 1 ? '1px solid var(--line-2)' : 'none',
            }}>
              <div style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                background: 'var(--lavender-soft)', color: 'var(--lavender)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t.icon}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{t.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer — agree checkbox + buttons */}
        <div style={{
          padding: '16px 28px 24px', flexShrink: 0,
          borderTop: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            cursor: 'pointer', userSelect: 'none',
          }}>
            <div onClick={() => setAgreed(a => !a)} style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: 6, marginTop: 1,
              border: `2px solid ${agreed ? 'var(--lavender)' : 'var(--line)'}`,
              background: agreed ? 'var(--lavender)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', cursor: 'pointer',
            }}>
              {agreed && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FBF8F0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              I have read and agree to these person-to-person connection guidelines and consent to the recording and use of session data as described. I confirm I am 18+ or have parental consent. I understand this is <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>peer support, not professional therapy</strong>.{' '}
              <a href="/terms#p2p" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--lavender)', textDecoration: 'underline' }}>
                Read full Terms &amp; Conditions →
              </a>
            </span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: 12,
              border: '1px solid var(--line)', background: 'var(--card)',
              color: 'var(--ink-2)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
            >
              Cancel
            </button>
            <button onClick={onAccept} disabled={!agreed} style={{
              flex: 2, padding: '12px', borderRadius: 12, border: 'none',
              background: agreed ? 'var(--lavender)' : 'var(--line)',
              color: agreed ? '#FBF8F0' : 'var(--muted)',
              fontSize: 14, fontWeight: 600,
              cursor: agreed ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {Icon.users(16)} Accept &amp; find a listener
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>,
    document.body
  );
}

// ── Peer-to-Peer Consent Modal ─────────────────────────────────────────────────

const PEER_CONSENT_TERMS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    title: 'Respectful communication',
    body: 'Both parties must treat each other with dignity. Abusive, offensive, or threatening language is strictly prohibited and will result in immediate call termination.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
      </svg>
    ),
    title: 'Session recording & data use',
    body: 'Sessions may be monitored or recorded for safety and quality purposes. By proceeding you consent to this data processing as described in our Privacy Policy.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/>
      </svg>
    ),
    title: 'Not a crisis service',
    body: 'This is peer support between equals — not professional therapy or an emergency service. If you are in immediate danger, please call 112 or your local emergency number.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
    title: 'Age requirement',
    body: 'You must be 18 years of age or older to use peer support sessions, or have the explicit written consent of a parent or legal guardian.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    ),
    title: 'Protect your privacy',
    body: 'Do not share personally identifying information such as your home address, phone number, or financial details. All calls are anonymous by design.',
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
    title: 'Mutual peer support',
    body: 'Your peer is also a registered user seeking connection — not a professional counsellor. Support goes both ways. Be present, be kind, and end calls gracefully.',
  },
];

function PeerConsentModal({ onAccept, onClose }: { onAccept: () => void; onClose: () => void }) {
  const [agreed, setAgreed] = React.useState(false);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.55)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-start',
      justifyContent: 'center', zIndex: 9999,
      padding: 'clamp(12px,4vw,24px) 16px', overflowY: 'auto',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="consent-modal" style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 560,
        display: 'flex', flexDirection: 'column',
        border: '1px solid var(--line)',
        boxShadow: '0 32px 64px rgba(15,20,17,0.18)',
        animation: 'fadeUp 0.25s ease both',
      }}>

        {/* Header */}
        <div className="consent-modal-hdr" style={{
          padding: '24px 28px 18px', flexShrink: 0,
          borderBottom: '1px solid var(--line)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '4px 12px', borderRadius: 999,
              background: 'var(--peach)', color: 'var(--ink-2)',
              fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10"/></svg>
              Before you begin
            </div>
            <div className="serif" style={{ fontSize: 24, fontWeight: 400, lineHeight: 1.2 }}>
              Peer-to-peer connection terms
            </div>
            <div className="consent-modal-desc" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>
              You are about to connect with another registered user for mutual peer support — an anonymous, encrypted, real-time voice call between two equals. Please read before proceeding.
            </div>
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
            border: '1px solid var(--line)', background: 'var(--card)',
            cursor: 'pointer', color: 'var(--muted)', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {/* Info banner */}
        <div className="consent-modal-banner" style={{
          margin: '14px 28px 0',
          background: 'rgba(185,155,120,0.08)',
          border: '1px solid rgba(185,155,120,0.22)',
          borderRadius: 12, padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
              Peer-to-Peer Support
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
              You are connecting with another registered user — not a professional or volunteer listener. This is mutual, anonymous peer support over an end-to-end encrypted WebRTC audio channel.
            </div>
          </div>
        </div>

        {/* Scrollable terms */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 28px 4px' }}>
          {PEER_CONSENT_TERMS.map((t, i) => (
            <div key={i} style={{
              display: 'flex', gap: 14, padding: '14px 0',
              borderBottom: i < PEER_CONSENT_TERMS.length - 1 ? '1px solid var(--line-2)' : 'none',
            }}>
              <div style={{
                flexShrink: 0, width: 34, height: 34, borderRadius: 10,
                background: 'var(--peach)', color: 'var(--ink-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {t.icon}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 3 }}>{t.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>{t.body}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 28px 24px', flexShrink: 0,
          borderTop: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
            <div onClick={() => setAgreed(a => !a)} style={{
              flexShrink: 0, width: 20, height: 20, borderRadius: 6, marginTop: 1,
              border: `2px solid ${agreed ? 'var(--sage)' : 'var(--line)'}`,
              background: agreed ? 'var(--sage)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s', cursor: 'pointer',
            }}>
              {agreed && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FBF8F0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              )}
            </div>
            <span style={{ fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.55 }}>
              I have read and agree to these peer-to-peer connection guidelines. I understand this is <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>peer support between equals, not professional therapy</strong>. I confirm I am 18+ or have parental consent.{' '}
              <a href="/terms#peer" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sage)', textDecoration: 'underline' }}>
                Read full Terms &amp; Conditions →
              </a>
            </span>
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '12px', borderRadius: 12,
              border: '1px solid var(--line)', background: 'var(--card)',
              color: 'var(--ink-2)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--card)')}
            >
              Cancel
            </button>
            <button onClick={onAccept} disabled={!agreed} style={{
              flex: 2, padding: '12px', borderRadius: 12, border: 'none',
              background: agreed ? 'var(--sage)' : 'var(--line)',
              color: agreed ? '#FBF8F0' : 'var(--muted)',
              fontSize: 14, fontWeight: 600,
              cursor: agreed ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
              </svg>
              Accept &amp; find a peer
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }`}</style>
    </div>,
    document.body
  );
}

// ── Razorpay helpers ────────────────────────────────────────────────────────────

function loadRazorpayScript(): Promise<void> {
  return new Promise(resolve => {
    if ((window as any).Razorpay) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    document.body.appendChild(s);
  });
}

// ── WalletCard ──────────────────────────────────────────────────────────────────

const TOP_UP_PRESETS = [500, 1000, 2000, 5000];

function WalletCard({ user }: { user: UserInfo }) {
  const [balance, setBalance] = React.useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = React.useState(true);
  const [showTopUp, setShowTopUp] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);
  const countedBalance = useCountUp(balance);

  const apiUrl = getSocketUrl();

  const fetchBalance = React.useCallback(() => {
    if (!user.email) { setLoadingBalance(false); return; }
    fetch(`${apiUrl}/api/users/${encodeURIComponent(user.email)}/wallet`, { headers: { Authorization: `Bearer ${getToken() || ''}` } })
      .then(r => r.json())
      .then(res => { if (res.success) setBalance(res.balance ?? 0); })
      .catch(() => setBalance(0))
      .finally(() => setLoadingBalance(false));
  }, [user.email, apiUrl]);

  // Fetch on mount
  React.useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Auto-open top-up modal when redirected from PeerCall with ?topup=1
  const searchParams = useSearchParams();
  React.useEffect(() => {
    if (searchParams.get('topup') === '1') setShowTopUp(true);
  }, [searchParams]);

  // Re-fetch whenever the user navigates back to this tab/page
  React.useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') fetchBalance(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetchBalance);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetchBalance);
    };
  }, [fetchBalance]);

  const handleTopUpSuccess = (newBalance: number) => {
    setBalance(newBalance);
    setShowTopUp(false);
  };

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage-2) 100%)',
        borderRadius: 20, padding: 28, color: '#F5F1E8',
        position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 56px rgba(80,107,90,0.40)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
      >
        <div aria-hidden style={{ position: 'absolute', right: -60, bottom: -60, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        <div aria-hidden style={{ position: 'absolute', right: 30, top: -50, width: 130, height: 130, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8, fontWeight: 500, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon.wallet(14)} Wallet balance
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, minHeight: 64 }}>
          {loadingBalance ? (
            <div style={{
              width: 160, height: 52, borderRadius: 10, alignSelf: 'center',
              background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 25%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.08) 75%)',
              backgroundSize: '400px 100%',
              animation: 'shimmerSlide 1.5s ease-in-out infinite',
            }} />
          ) : (
            <span className="serif" style={{ fontSize: 52, fontWeight: 400, letterSpacing: -0.01 }}>
              ₹{countedBalance.toLocaleString('en-IN')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
          {loadingBalance ? ' ' : balance !== null && balance >= 1200 ? 'Enough for a therapy session' : balance === 0 ? 'Add funds to book sessions' : 'Available for sessions'}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button onClick={() => setShowTopUp(true)} style={{
            flex: 1, padding: '12px', borderRadius: 12, border: 'none',
            background: '#FBF8F0', color: 'var(--sage)',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            transition: 'opacity 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            {Icon.plus(14)} Top up
          </button>
          <button onClick={() => setShowHistory(true)} style={{
            flex: 1, padding: '12px', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.25)',
            background: 'transparent', color: '#F5F1E8',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            History
          </button>
        </div>
      </div>

      {showTopUp && (
        <TopUpModal
          user={user}
          apiUrl={apiUrl}
          onSuccess={handleTopUpSuccess}
          onClose={() => setShowTopUp(false)}
        />
      )}
      {showHistory && (
        <HistoryModal
          user={user}
          apiUrl={apiUrl}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}

// ── Top-up Modal ────────────────────────────────────────────────────────────────

function TopUpModal({ user, apiUrl, onSuccess, onClose }: {
  user: UserInfo; apiUrl: string;
  onSuccess: (newBalance: number) => void; onClose: () => void;
}) {
  const [amount, setAmount] = React.useState<number>(1000);
  const [custom, setCustom] = React.useState('');
  const [processing, setProcessing] = React.useState(false);
  const [error, setError] = React.useState('');
  if (typeof document === 'undefined') return null;

  const finalAmount = custom ? parseInt(custom) || 0 : amount;

  const handlePay = async () => {
    if (finalAmount < 1) { setError('Enter a valid amount.'); return; }
    setProcessing(true);
    setError('');
    try {
      const token = getToken() || '';
      if (!token) {
        setError('Please sign in again, then try adding funds.');
        setProcessing(false);
        return;
      }

      const orderResponse = await fetch(`${apiUrl}/api/users/razorpay/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: finalAmount }),
      });

      const orderRaw = await orderResponse.text();
      let orderRes: any = {};
      try { orderRes = orderRaw ? JSON.parse(orderRaw) : {}; } catch { orderRes = { error: orderRaw || 'Could not create order.' }; }

      if (!orderResponse.ok || !orderRes.success) {
        setError(orderRes.error || orderRes.message || `Could not create order (${orderResponse.status}).`);
        setProcessing(false);
        return;
      }

      await loadRazorpayScript();

      const rzp = new (window as any).Razorpay({
        key: orderRes.key,
        amount: orderRes.amount,
        currency: orderRes.currency,
        order_id: orderRes.orderId,
        name: 'मनmate',
        description: 'Wallet top-up',
        prefill: { name: user.name, email: user.email || '' },
        theme: { color: '#506B5A' },
        modal: { ondismiss: () => setProcessing(false) },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verifyRes = await fetch(`${apiUrl}/api/users/razorpay/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                amount: finalAmount,
                email: user.email,
              }),
            }).then(r => r.json());

            if (verifyRes.success) {
              onSuccess(verifyRes.newBalance);
            } else {
              setError('Payment verified but balance update failed. Contact support.');
              setProcessing(false);
            }
          } catch {
            setError('Verification failed. Contact support.');
            setProcessing(false);
          }
        },
      });

      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.5)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 420,
        border: '1px solid var(--line)', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Add funds</div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 400 }}>Top up wallet</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 10 }}>Select amount</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {TOP_UP_PRESETS.map(p => (
                <button key={p} onClick={() => { setAmount(p); setCustom(''); }} style={{
                  padding: '14px', borderRadius: 12,
                  border: `1px solid ${amount === p && !custom ? 'var(--sage)' : 'var(--line)'}`,
                  background: amount === p && !custom ? 'var(--sage-soft)' : 'var(--card)',
                  color: amount === p && !custom ? 'var(--sage)' : 'var(--ink)',
                  cursor: 'pointer', fontSize: 16, fontWeight: 600, transition: 'all 0.15s',
                }}>
                  ₹{p.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500, marginBottom: 8 }}>Or enter custom amount</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)' }}>₹</span>
              <input
                type="number" min="1" value={custom}
                onChange={e => setCustom(e.target.value)}
                placeholder="e.g. 1500"
                style={{
                  width: '100%', padding: '12px 14px 12px 28px',
                  borderRadius: 12, border: `1px solid ${custom ? 'var(--sage)' : 'var(--line)'}`,
                  background: 'var(--card)', color: 'var(--ink)', fontSize: 15,
                  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)', fontSize: 13 }}>{error}</div>
          )}

          <button onClick={handlePay} disabled={processing || finalAmount < 1} style={{
            padding: '15px', borderRadius: 14, border: 'none',
            background: 'var(--sage)', color: '#FBF8F0',
            fontSize: 15, fontWeight: 600, cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing || finalAmount < 1 ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.2s',
          }}>
            {processing ? 'Opening Razorpay…' : `Pay ₹${finalAmount.toLocaleString('en-IN')} via Razorpay`}
          </button>

          <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Secured by Razorpay · 256-bit encryption
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── History Modal ───────────────────────────────────────────────────────────────

interface Transaction {
  _id: string; type: 'credit' | 'debit'; amount: number;
  description: string; timestamp: string; razorpay_payment_id?: string;
}

function HistoryModal({ user, apiUrl, onClose }: { user: UserInfo; apiUrl: string; onClose: () => void }) {
  const [txns, setTxns] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user.email) { setLoading(false); return; }
    fetch(`${apiUrl}/api/users/${encodeURIComponent(user.email)}/transactions?limit=30`, { headers: { Authorization: `Bearer ${getToken() || ''}` } })
      .then(r => r.json())
      .then(res => { if (res.success) setTxns(res.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.email]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.5)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 480,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
        border: '1px solid var(--line)', overflow: 'hidden',
      }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Wallet</div>
            <div className="serif" style={{ fontSize: 22, fontWeight: 400 }}>Transaction history</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)', background: 'var(--card)', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 28px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
          )}
          {!loading && txns.length === 0 && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
              <div className="serif" style={{ fontSize: 18, marginBottom: 8 }}>No transactions yet</div>
              <div style={{ fontSize: 13 }}>Your top-ups and session payments will appear here.</div>
            </div>
          )}
          {!loading && txns.map((t, i) => {
            const isCredit = t.type === 'credit';
            const date = new Date(t.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div key={t._id || i} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 0',
                borderBottom: i < txns.length - 1 ? '1px solid var(--line-2)' : 'none',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: isCredit ? 'var(--sage-soft)' : 'rgba(178,107,92,0.1)',
                  color: isCredit ? 'var(--sage)' : 'var(--alert)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isCredit
                    ? Icon.plus(16)
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/></svg>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{date}</div>
                </div>
                <div className="serif" style={{ fontSize: 18, fontWeight: 500, color: isCredit ? 'var(--sage)' : 'var(--alert)', flexShrink: 0 }}>
                  {isCredit ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function UpcomingSessions() {
  const router = useRouter();
  const apiUrl = getSocketUrl();
  const [appointments, setAppointments] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    fetch(`${apiUrl}/api/appointments/user`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          const now = new Date();
          now.setHours(0, 0, 0, 0);
          const upcoming = (res.data as any[]).filter(
            a => new Date(a.date) >= now && !['cancelled', 'completed'].includes(a.status)
          );
          setAppointments(upcoming);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(31,42,36,0.10)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
          Upcoming sessions
        </div>
        <button onClick={() => router.push('/therapists')} style={{ background: 'none', border: 'none', color: 'var(--sage)', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
          Book a session
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 72, borderRadius: 12,
              background: 'linear-gradient(90deg, var(--line) 25%, var(--line-2) 50%, var(--line) 75%)',
              backgroundSize: '400px 100%',
              animation: 'shimmerSlide 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : appointments.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 0', gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--sage-soft)', color: 'var(--sage)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'breathe 3.5s ease-in-out infinite',
          }}>
            {Icon.calendar(22)}
          </div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 400, color: 'var(--ink)' }}>No upcoming sessions</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 260 }}>
            Book a session with a verified therapist to get started.
          </div>
          <button onClick={() => router.push('/therapists')} style={{
            marginTop: 4, padding: '10px 22px', borderRadius: 12, border: 'none',
            background: 'var(--sage)', color: '#FBF8F0',
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
            transition: 'opacity 0.15s, transform 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = ''; }}
          >
            Browse therapists
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {appointments.map(a => (
            <div key={a._id} style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '14px 16px', borderRadius: 14,
              border: '1px solid var(--line-2)', background: 'var(--bg)',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                background: 'var(--sage-soft)', color: 'var(--sage)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {Icon.calendar(18)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                  {a.therapistId?.name || 'Therapist'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {formatDate(a.date)} · {a.timeSlot}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '4px 10px',
                borderRadius: 999,
                background: a.status === 'confirmed' ? 'var(--sage-soft)' : '#FEF3C7',
                color: a.status === 'confirmed' ? 'var(--sage)' : '#92400E',
              }}>
                {a.status === 'confirmed' ? 'Confirmed' : 'Pending confirmation'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MoodStreak({ refreshKey = 0 }: { refreshKey?: number }) {
  const [levels, setLevels] = React.useState<Record<string, number>>({});
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const token = getToken();
    if (!token) { setLoaded(true); return; }
    fetch(`${getSocketUrl()}/api/moods?days=14`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(res => {
        if (res?.success) {
          const map: Record<string, number> = {};
          (res.data?.entries || []).forEach((e: { dateKey: string; level: number }) => {
            map[e.dateKey] = e.level;
          });
          setLevels(map);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [refreshKey]);

  // Build the last 14 calendar days, oldest -> newest.
  const days = React.useMemo(() => {
    const out: { key: string; label: string }[] = [];
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      out.push({
        key: toDateKey(d),
        label: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
      });
    }
    return out;
  }, []);

  const loggedCount = days.filter(d => levels[d.key] !== undefined).length;

  return (
    <div
      style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 'clamp(14px,3vw,28px)', transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(31,42,36,0.10)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>
        Mood · last 14 days
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(10px,2vw,24px) 0', gap: 8,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 'clamp(4px, 1.5vw, 6px)', width: '100%', marginBottom: 10 }}>
          {days.map((d, i) => {
            const level = levels[d.key];
            const has = level !== undefined;
            return (
              <div key={d.key} title={has ? `${d.label}: ${MOOD_LABELS[level]}` : `${d.label}: no entry`} style={{
                width: 'clamp(16px, 5vw, 24px)',
                height: 'clamp(16px, 5vw, 24px)',
                borderRadius: 6,
                background: has ? MOOD_COLORS[level] : 'var(--line)',
                animation: `${has ? 'moodDotFill' : 'moodDotIn'} 0.5s ease both`,
                animationDelay: `${i * 45}ms`,
                flexShrink: 0,
              }} />
            );
          })}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center' }}>
          {!loaded
            ? 'Loading your mood history…'
            : loggedCount === 0
              ? 'Start logging your mood to track how you’re feeling over time.'
              : `You’ve logged your mood on ${loggedCount} of the last 14 days.`}
        </div>
      </div>
    </div>
  );
}

function FavoritesCard() {
  const router = useRouter();
  const [favorites, setFavorites] = React.useState<Favorite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statuses, setStatuses] = React.useState<Record<string, 'online' | 'busy' | 'offline'>>({});

  React.useEffect(() => {
    const u = getCurrentUser();
    if (!u?.email) { setLoading(false); return; }
    getFavorites(u.email)
      .then(setFavorites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll which favorite listeners are currently online so we can offer a real
  // reconnect (and show offline ones as unavailable).
  React.useEffect(() => {
    const emails = favorites
      .filter(f => f.role === 'listener' && f.email)
      .map(f => (f.email as string).toLowerCase());
    if (emails.length === 0) { setStatuses({}); return; }

    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnection: false });
    const check = () => socket.emit('check-listeners-online', { emails });
    socket.on('connect', check);
    socket.on('listeners-online', ({ statuses: s }: { statuses?: Record<string, 'online' | 'busy' | 'offline'> }) => {
      setStatuses(s || {});
    });
    const poll = setInterval(check, 15000);
    return () => { clearInterval(poll); socket.disconnect(); };
  }, [favorites]);

  // 'Connect again' for a listener targets that exact listener's own queue (via
  // ?to=email). Peers are anonymous, so they fall back to the normal queue.
  function reconnect(fav: Favorite) {
    if (fav.role === 'peer') {
      router.push(fav.mode === 'call' ? '/peer-call?mode=peer' : '/chat?mode=peer');
    } else if (fav.email) {
      const to = encodeURIComponent(fav.email);
      router.push(fav.mode === 'call' ? `/peer-call?to=${to}` : `/chat?to=${to}`);
    } else {
      router.push(fav.mode === 'call' ? '/peer-call' : '/chat');
    }
  }

  async function handleRemove(fav: Favorite) {
    const u = getCurrentUser();
    if (!u?.email) return;
    setFavorites(prev => prev.filter(f => f.id !== fav.id)); // optimistic
    try { await removeFavorite(u.email, fav.id); } catch { /* best-effort */ }
  }

  return (
    <div
      style={{ marginTop: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(31,42,36,0.10)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>
        Favorites
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2].map(i => (
            <div key={i} style={{
              height: 64, borderRadius: 12,
              background: 'linear-gradient(90deg, var(--line) 25%, var(--line-2) 50%, var(--line) 75%)',
              backgroundSize: '400px 100%',
              animation: 'shimmerSlide 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 0', gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--lavender-soft)', color: 'var(--lavender)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'breathe 3.5s ease-in-out infinite',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
            </svg>
          </div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 400, color: 'var(--ink)' }}>No favorites yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 320 }}>
            Tap the heart during or after a session to save a listener or peer here, then reconnect anytime.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {favorites.map(fav => {
            const isPeer = fav.role === 'peer';
            // Only listener favorites with an email can be targeted/presence-checked.
            const trackable = !isPeer && !!fav.email;
            const status = trackable ? (statuses[(fav.email as string).toLowerCase()] || 'offline') : null;
            const isOnline = status === 'online';
            const isBusy = status === 'busy';
            const dotColor = isOnline ? '#3F9168' : isBusy ? '#E3B341' : 'var(--muted)';
            const statusLabel = isOnline ? 'Online' : isBusy ? 'Busy' : 'Offline';
            const statusColor = isOnline ? 'var(--sage)' : isBusy ? '#9A7B1F' : 'var(--muted)';
            // Peers always allow reconnect (anonymous queue); listeners only when online.
            const canConnect = isPeer || !trackable || isOnline;
            return (
              <div key={fav.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 16px', borderRadius: 14,
                border: '1px solid var(--line-2)', background: 'var(--bg)',
              }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: isPeer ? 'var(--peach)' : 'var(--lavender-soft)',
                    color: isPeer ? 'var(--ink-2)' : 'var(--lavender)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 600, fontSize: 16,
                  }}>
                    {(fav.name || '?').charAt(0).toUpperCase()}
                  </div>
                  {trackable && (
                    <span title={statusLabel} style={{
                      position: 'absolute', right: -1, bottom: -1,
                      width: 13, height: 13, borderRadius: '50%',
                      background: dotColor,
                      border: '2px solid var(--card)',
                    }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {fav.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {isPeer ? 'Peer' : 'Listener'}
                    {trackable && <> · <span style={{ color: statusColor, fontWeight: 500 }}>{statusLabel}</span></>}
                    {' · '}via {fav.mode === 'call' ? 'voice call' : 'text chat'}
                  </div>
                </div>
                {canConnect ? (
                  <button onClick={() => reconnect(fav)} style={{
                    padding: '8px 16px', borderRadius: 10, flexShrink: 0,
                    border: 'none', background: 'var(--lavender)', color: '#FBF8F0',
                    fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                  >
                    Connect again
                  </button>
                ) : (
                  <span style={{
                    padding: '8px 16px', borderRadius: 10, flexShrink: 0,
                    border: `1px solid ${isBusy ? 'rgba(227,179,65,0.4)' : 'var(--line)'}`,
                    background: isBusy ? 'rgba(227,179,65,0.12)' : 'var(--bg-2)',
                    color: isBusy ? '#9A7B1F' : 'var(--muted)', fontSize: 13, fontWeight: 600,
                  }}>
                    {isBusy ? 'Busy' : 'Offline'}
                  </span>
                )}
                <button onClick={() => handleRemove(fav)} title="Remove favorite" style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  border: '1px solid var(--line)', background: 'var(--card)',
                  color: 'var(--muted)', fontSize: 16, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SessionItem {
  id: string;
  kind: 'chat' | 'call' | 'therapist';
  title: string;
  detail: string;
  status?: 'completed' | 'cancelled' | 'confirmed' | 'pending';
  date: Date;
}

function PastActivity() {
  const apiUrl = getSocketUrl();
  const [items, setItems] = React.useState<SessionItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    const auth = { headers: { Authorization: `Bearer ${token}` } };

    Promise.all([
      fetch(`${apiUrl}/api/calls/history`, auth).then(r => r.json()).catch(() => ({})),
      fetch(`${apiUrl}/api/appointments/user`, auth).then(r => r.json()).catch(() => ({})),
    ]).then(([callsRes, apptRes]) => {
      const merged: SessionItem[] = [];

      // Listener chat & voice sessions
      if (callsRes?.success && Array.isArray(callsRes.data)) {
        for (const c of callsRes.data as any[]) {
          const isChat = c.type === 'chat';
          const isPeer = c.counterpart === 'peer';
          const mins = c.durationMinutes || 0;
          merged.push({
            id: c._id || `${c.endedAt}_${c.listenerEmail || 'peer'}`,
            kind: isChat ? 'chat' : 'call',
            title: c.listenerName || (isPeer ? 'Peer' : 'Listener'),
            detail: `${isChat ? 'Text chat' : 'Voice call'} with a ${isPeer ? 'peer' : 'listener'} · ${mins} min`,
            date: new Date(c.endedAt || c.startedAt || Date.now()),
          });
        }
      }

      // Therapist appointments — all of them, so a fresh booking shows up here too
      if (apptRes?.success && Array.isArray(apptRes.data)) {
        for (const a of apptRes.data as any[]) {
          merged.push({
            id: a._id,
            kind: 'therapist',
            title: a.therapistId?.name || 'Therapist',
            detail: `Therapist session${a.timeSlot ? ` · ${a.timeSlot}` : ''}`,
            status: a.status,
            date: new Date(a.date),
          });
        }
      }

      merged.sort((x, y) => y.date.getTime() - x.date.getTime());
      setItems(merged.slice(0, 50));
    }).finally(() => setLoading(false));
  }, [apiUrl]);

  const iconFor = (kind: SessionItem['kind']) => {
    if (kind === 'chat') {
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
    }
    if (kind === 'call') {
      return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/></svg>;
    }
    return Icon.calendar(18);
  };

  const toneFor = (kind: SessionItem['kind']) =>
    kind === 'therapist'
      ? { bg: 'var(--sage-soft)', fg: 'var(--sage)' }
      : kind === 'chat'
        ? { bg: 'var(--peach)', fg: 'var(--ink-2)' }
        : { bg: 'var(--lavender-soft)', fg: 'var(--lavender)' };

  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  const PAGE_SIZE = 10;
  const [page, setPage] = React.useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div
      style={{ marginTop: 20, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, transition: 'transform 0.3s ease, box-shadow 0.3s ease' }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(31,42,36,0.10)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = ''; }}
    >
      <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>
        Recent sessions
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 64, borderRadius: 12,
              background: 'linear-gradient(90deg, var(--line) 25%, var(--line-2) 50%, var(--line) 75%)',
              backgroundSize: '400px 100%',
              animation: 'shimmerSlide 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 0', gap: 12,
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: 'var(--lavender-soft)', color: 'var(--lavender)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'breathe 3.5s ease-in-out 0.6s infinite',
          }}>
            {Icon.users(22)}
          </div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 400, color: 'var(--ink)' }}>No sessions yet</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 300 }}>
            Your completed sessions with listeners, peers, and therapists will appear here.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pageItems.map(item => {
              const tone = toneFor(item.kind);
              return (
                <div key={item.id} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px', borderRadius: 14,
                  border: '1px solid var(--line-2)', background: 'var(--bg)',
                }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                    background: tone.bg, color: tone.fg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {iconFor(item.kind)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.detail}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{fmtDate(item.date)}</span>
                    {item.status === 'cancelled' && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)' }}>Cancelled</span>}
                    {item.status === 'completed' && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Completed</span>}
                    {item.status === 'confirmed' && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'var(--sage-soft)', color: 'var(--sage)' }}>Confirmed</span>}
                    {item.status === 'pending'   && <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: '#FEF3C7', color: '#92400E' }}>Pending</span>}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination row */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
              gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line-2)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--muted)', marginRight: 4 }}>
                {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} of {items.length}
              </span>
              <button
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)',
                  background: page === 0 ? 'transparent' : 'var(--bg)',
                  color: page === 0 ? 'var(--line)' : 'var(--ink-2)',
                  cursor: page === 0 ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (page > 0) e.currentTarget.style.background = 'var(--bg-2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = page === 0 ? 'transparent' : 'var(--bg)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                style={{
                  width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--line)',
                  background: page >= totalPages - 1 ? 'transparent' : 'var(--sage)',
                  color: page >= totalPages - 1 ? 'var(--line)' : '#FBF8F0',
                  cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (page < totalPages - 1) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
