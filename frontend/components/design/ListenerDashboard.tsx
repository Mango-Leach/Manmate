'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Avatar, Pill, GlobalHeader, type UserInfo } from './primitives';
import { clearUser, getToken } from '@/lib/api';
import { io, type Socket } from 'socket.io-client';

function getSocketUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (raw.startsWith('http')) return raw;
  if (!raw.includes('.')) return `https://${raw}.onrender.com`;
  return raw.includes('localhost') || raw.includes('127.0.0.1') ? `http://${raw}` : `https://${raw}`;
}

const TIPS = [
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
      </svg>
    ),
    title: 'Find a quiet space',
    desc: 'Minimize background noise so the person you support feels heard clearly.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    ),
    title: 'Listen first',
    desc: 'Resist the urge to give advice. Your presence and attention matter most.',
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>
      </svg>
    ),
    title: 'Stay non-judgmental',
    desc: "Accept what is shared without evaluating. Everyone's experience is valid.",
  },
];

interface ListenerStats {
  totalCalls: number;
  totalHours: number;
  rating: number;
}

export function ListenerDashboard({ user }: { user: UserInfo }) {
  const router = useRouter();
  const [online, setOnline] = useState(false);
  const [clientsWaiting, setClientsWaiting] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [stats, setStats] = useState<ListenerStats | null>(null);
  // Set when a client uses "Connect again" to reconnect specifically with us.
  const [favoriteWaiting, setFavoriteWaiting] = useState<{ kind: 'call' | 'chat'; clientName: string } | null>(null);

  useEffect(() => {
    if (!user.email) return;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${apiUrl}/api/users/${encodeURIComponent(user.email)}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } })
      .then(r => r.json())
      .then(res => {
        if (res?.success && res.data) {
          const p = res.data.listenerProfile || {};
          setStats({
            totalCalls: p.totalCalls || 0,
            totalHours: parseFloat(((p.totalMinutes || 0) / 60).toFixed(1)),
            rating: p.rating || 0,
          });
        }
      })
      .catch(() => null);
  }, [user.email]);

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, []);

  function handleToggle() {
    if (online) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      setOnline(false);
      setSocketConnected(false);
      setClientsWaiting(0);
    } else {
      const socket = io(getSocketUrl(), {
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      socketRef.current = socket;

      socket.on('connect', () => {
        setSocketConnected(true);
        setOnline(true);
        socket.emit('go-online', { name: user.name, email: user.email || '', role: 'listener' });
        socket.emit('get-queue-stats');
      });

      socket.on('connect_error', () => {
        setSocketConnected(false);
        setOnline(false);
      });

      socket.on('queue-update', (stats: { clientsWaiting?: number; usersWaiting?: number }) => {
        setClientsWaiting(stats.clientsWaiting ?? stats.usersWaiting ?? 0);
      });

      socket.on('online-success', (data: { stats: { clientsWaiting?: number; usersWaiting?: number } }) => {
        setClientsWaiting(data.stats.clientsWaiting ?? data.stats.usersWaiting ?? 0);
      });

      // A favorited client is waiting to reconnect specifically with us.
      socket.on('favorite-waiting', (info: { kind?: 'call' | 'chat'; clientName?: string }) => {
        setFavoriteWaiting({ kind: info?.kind === 'chat' ? 'chat' : 'call', clientName: info?.clientName || 'Someone' });
      });

      socket.on('disconnect', () => setSocketConnected(false));
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <GlobalHeader user={user} />

      <div className="dash-pad">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Greeting */}
          <ListenerGreeting
            user={user}
            online={online}
            socketConnected={socketConnected}
            clientsWaiting={clientsWaiting}
            onToggle={handleToggle}
          />

          {/* "Connect again" — a favorited client is waiting specifically for us */}
          {favoriteWaiting && (
            <div style={{
              marginTop: 20, padding: '16px 20px', borderRadius: 16,
              background: 'var(--lavender-soft)', border: '1px solid var(--lavender)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
              animation: 'fadeUp 0.3s ease both',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--lavender)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--lavender)' }}>
                    {favoriteWaiting.clientName} wants to reconnect with you
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>
                    They saved you as a favorite · start a {favoriteWaiting.kind === 'chat' ? 'chat' : 'voice call'} to connect
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => router.push(favoriteWaiting.kind === 'chat' ? '/chat' : '/peer-call')} style={{
                  padding: '9px 18px', borderRadius: 10, border: 'none',
                  background: 'var(--lavender)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  Start {favoriteWaiting.kind === 'chat' ? 'chat' : 'call'}
                </button>
                <button onClick={() => setFavoriteWaiting(null)} title="Dismiss" style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  border: '1px solid var(--lavender)', background: 'transparent',
                  color: 'var(--lavender)', fontSize: 16, cursor: 'pointer',
                }}>×</button>
              </div>
            </div>
          )}

          {/* Main grid */}
          <div className="g2w" style={{ marginTop: 32 }}>
            <AvailabilityPanel
              online={online}
              socketConnected={socketConnected}
              clientsWaiting={clientsWaiting}
              onToggle={handleToggle}
              onStart={() => router.push('/peer-call')}
            />
            <StatsCard stats={stats} />
          </div>

          {/* Chat mode panel */}
          <div style={{ marginTop: 20 }}>
            <ChatModePanel onStartChat={() => router.push('/chat')} />
          </div>

          {/* Tips */}
          <TipsSection />

        </div>
      </div>
    </div>
  );
}

// ── Greeting ────────────────────────────────────────────────────────────────────

function ListenerGreeting({
  user, online, socketConnected, clientsWaiting, onToggle,
}: {
  user: UserInfo; online: boolean; socketConnected: boolean;
  clientsWaiting: number; onToggle: () => void;
}) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dash-greet" style={{ animation: 'fadeUp 0.4s ease both' }}>
      <div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 10 }}>
          {greet}, {user.name.split(' ')[0]}.
        </div>
        <h1 className="serif" style={{ fontSize: 'clamp(28px, 5vw, 52px)', margin: 0, fontWeight: 400, letterSpacing: -0.015, lineHeight: 1.05 }}>
          {online
            ? clientsWaiting > 0
              ? <>Someone needs <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>you</em> right now.</>
              : <>You&apos;re <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>live</em> and listening.</>
            : <>Ready to make a <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>difference</em>?</>}
        </h1>
      </div>

      {/* Compact online toggle in header area */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, paddingBottom: 4 }}>
        {online && socketConnected && (
          <span style={{ fontSize: 13, color: 'var(--lavender)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: 'var(--lavender)',
              boxShadow: '0 0 0 3px var(--lavender-soft)',
              display: 'inline-block', animation: 'pulse 2s infinite',
            }} />
            {clientsWaiting > 0 ? `${clientsWaiting} waiting` : 'Visible to users'}
          </span>
        )}
        <button
          onClick={onToggle}
          style={{
            padding: '10px 20px', borderRadius: 999, cursor: 'pointer',
            background: online ? 'var(--lavender-soft)' : 'var(--card)',
            color: online ? 'var(--lavender)' : 'var(--muted)',
            fontSize: 14, fontWeight: 500,
            border: `1px solid ${online ? 'var(--lavender-soft)' : 'var(--line)'}`,
            transition: 'all 0.2s',
            display: 'flex', alignItems: 'center', gap: 8,
          } as React.CSSProperties}
        >
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: online ? 'var(--lavender)' : 'var(--muted)',
            transition: 'background 0.3s',
          }} />
          {online ? (socketConnected ? 'Online' : 'Connecting…') : 'Go online'}
        </button>
      </div>
    </div>
  );
}

// ── Availability Panel ──────────────────────────────────────────────────────────

function AvailabilityPanel({
  online, socketConnected, clientsWaiting, onToggle, onStart,
}: {
  online: boolean; socketConnected: boolean; clientsWaiting: number;
  onToggle: () => void; onStart: () => void;
}) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28,
      animation: 'fadeUp 0.4s ease 0.05s both',
    }}>
      <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>
        Listener status
      </div>

      {/* Status display */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24 }}>
        {/* Pulsing icon */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: online ? 'var(--lavender-soft)' : 'var(--bg-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: online ? 'var(--lavender)' : 'var(--muted)',
            transition: 'all 0.4s',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 18v-6a9 9 0 0118 0v6"/>
              <path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/>
            </svg>
          </div>
          {online && socketConnected && (
            <>
              <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid var(--lavender)', opacity: 0.35, animation: 'ring 2s infinite ease-out' }} />
              <div style={{ position: 'absolute', inset: -16, borderRadius: '50%', border: '2px solid var(--lavender)', opacity: 0.15, animation: 'ring 2s 0.7s infinite ease-out' }} />
            </>
          )}
        </div>

        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 22, fontWeight: 400, marginBottom: 4, color: 'var(--ink)' }}>
            {online
              ? socketConnected
                ? clientsWaiting > 0
                  ? `${clientsWaiting} ${clientsWaiting === 1 ? 'person needs' : 'people need'} support`
                  : 'Waiting for a connection'
                : 'Connecting to server…'
              : "You're currently offline"}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
            {online
              ? clientsWaiting > 0
                ? 'Start a call to connect with someone who needs support right now.'
                : 'You\'re visible to users. Someone may reach out to you shortly.'
              : 'Go online to make yourself available. You can disconnect anytime.'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onStart}
          disabled={!online || !socketConnected}
          style={{
            flex: 1, padding: '14px 20px', borderRadius: 14, border: 'none',
            background: online && socketConnected ? 'var(--lavender)' : 'var(--bg-2)',
            color: online && socketConnected ? '#FBF8F0' : 'var(--muted)',
            fontSize: 15, fontWeight: 500, cursor: online && socketConnected ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            transition: 'all 0.2s',
            boxShadow: online && socketConnected ? '0 4px 16px rgba(168,156,196,0.3)' : 'none',
          }}
          onMouseEnter={e => { if (online && socketConnected) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,156,196,0.4)'; } }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = online && socketConnected ? '0 4px 16px rgba(168,156,196,0.3)' : 'none'; }}
        >
          {Icon.users(16)}
          Start a call
        </button>
        <button
          onClick={onToggle}
          style={{
            padding: '14px 20px', borderRadius: 14,
            border: '1px solid var(--line)',
            background: online ? 'var(--bg-2)' : 'var(--card)',
            color: online ? 'var(--alert)' : 'var(--sage)',
            fontSize: 15, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = online ? 'var(--bg-2)' : 'var(--card)'; }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: online ? 'var(--alert)' : 'var(--sage)' }} />
          {online ? 'Go offline' : 'Go online'}
        </button>
      </div>
    </div>
  );
}

// ── Stats Card ──────────────────────────────────────────────────────────────────

function StatsCard({ stats }: { stats: ListenerStats | null }) {
  const rows = [
    { label: 'People helped', value: stats ? String(stats.totalCalls) : '—', sub: 'All time' },
    { label: 'Hours listened', value: stats ? String(stats.totalHours) : '—', sub: 'All time' },
    { label: 'Your rating', value: stats?.rating ? stats.rating.toFixed(1) : '—', sub: 'Avg. score' },
  ];

  return (
    <div style={{
      background: 'linear-gradient(140deg, var(--lavender) 0%, #8F80AA 100%)',
      borderRadius: 20, padding: 28, color: '#FBF8F0',
      position: 'relative', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeUp 0.4s ease 0.1s both',
    }}>
      {/* Decorative orbs */}
      <div aria-hidden style={{ position: 'absolute', right: -50, bottom: -50, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
      <div aria-hidden style={{ position: 'absolute', left: -30, top: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.75, fontWeight: 500, marginBottom: 20 }}>
          Your impact
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flex: 1 }}>
          {rows.map((s, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 0',
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none',
            }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.75 }}>{s.label}</div>
                <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{s.sub}</div>
              </div>
              <div className="serif" style={{ fontSize: 28, fontWeight: 400, letterSpacing: -0.01 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.12)' }}>
          <div style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>
            Stats are updated after each completed session.
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chat Mode Panel ─────────────────────────────────────────────────────────────

function ChatModePanel({ onStartChat }: { onStartChat: () => void }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28,
      animation: 'fadeUp 0.4s ease 0.15s both',
    }}>
      <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>
        Chat mode
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%', flexShrink: 0,
          background: 'var(--lavender-soft)', color: 'var(--lavender)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 400, marginBottom: 4, color: 'var(--ink)' }}>
            Support someone through text
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
            Go online for text chat. When matched with a client, you can also offer to switch to a voice call — only if both of you agree.
          </div>
        </div>

        <button
          onClick={onStartChat}
          style={{
            flexShrink: 0, padding: '13px 24px', borderRadius: 14, border: 'none',
            background: 'var(--lavender)', color: '#FBF8F0',
            fontSize: 14, fontWeight: 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            boxShadow: '0 4px 16px rgba(168,156,196,0.3)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(168,156,196,0.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(168,156,196,0.3)'; }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          Go online for chat
        </button>
      </div>
    </div>
  );
}

// ── Tips Section ────────────────────────────────────────────────────────────────

function TipsSection() {
  return (
    <div style={{ marginTop: 20, animation: 'fadeUp 0.4s ease 0.2s both' }}>
      <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>
          Tips for a good session
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          {TIPS.map((t, i) => (
            <div key={i} style={{
              padding: '20px 20px',
              borderRadius: 14,
              border: '1px solid var(--line-2)',
              background: 'var(--bg)',
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--lavender-soft)', color: 'var(--lavender)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                {t.icon}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: 'var(--ink)' }}>{t.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.55 }}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
