'use client';
import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getRoleDashboard } from '@/lib/api';

// ── Icons ──────────────────────────────────────────────────────────────────────
export const Icon = {
  mic: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3"/></svg>,
  micOff: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l18 18"/><path d="M9 9v3a3 3 0 005.12 2.12"/><path d="M15 9.34V6a3 3 0 00-5.94-.6"/></svg>,
  phoneDown: (s = 20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22.94 12.06a16 16 0 00-21.88 0l2.54 2.54a2 2 0 002.12.45l2.3-.83a2 2 0 001.31-1.82V11a10.7 10.7 0 017.34 0v1.4a2 2 0 001.3 1.82l2.31.83a2 2 0 002.12-.45l2.54-2.54z"/></svg>,
  wallet: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-5"/><path d="M16 12h5"/><circle cx="16" cy="12" r="1.5" fill="currentColor"/></svg>,
  calendar: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>,
  video: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="14" height="12" rx="2"/><path d="M22 8l-6 4 6 4V8z"/></svg>,
  arrow: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  back: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>,
  check: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  sparkle: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>,
  heart: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>,
  users: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  leaf: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 014 13V6a2 2 0 012-2h7a7 7 0 017 7 7 7 0 01-7 7h-2z"/><path d="M4 22c3-3 6-5 9-6"/></svg>,
  search: (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>,
  plus: (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>,
  star: (s = 14, c = 'currentColor') => <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14l-5-4.87 6.91-1.01L12 2z"/></svg>,
};

// ── Avatar ─────────────────────────────────────────────────────────────────────
type AvatarTone = 'sage' | 'lavender' | 'peach' | 'rose' | 'sky' | 'moss';

export function Avatar({ name, tone = 'sage', size = 44 }: { name: string; tone?: AvatarTone; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const bgs: Record<AvatarTone, string> = {
    sage: 'linear-gradient(135deg,#B8CEBF 0%,#7D9B86 100%)',
    lavender: 'linear-gradient(135deg,#CFC5E2 0%,#A296C1 100%)',
    peach: 'linear-gradient(135deg,#EDD6BD 0%,#D4A486 100%)',
    rose: 'linear-gradient(135deg,#E4C4C2 0%,#C09190 100%)',
    sky: 'linear-gradient(135deg,#BFD3DB 0%,#8BAAB5 100%)',
    moss: 'linear-gradient(135deg,#C9D4B0 0%,#8EA077 100%)',
  };
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bgs[tone] || bgs.sage,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'rgba(255,255,255,.95)',
      fontFamily: 'Newsreader, serif', fontSize: size * 0.38, fontWeight: 500,
      letterSpacing: 0.5, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

// ── Pill ───────────────────────────────────────────────────────────────────────
type PillTone = 'default' | 'sage' | 'lavender' | 'ghost';

export function Pill({ children, tone = 'default', style = {} }: { children: React.ReactNode; tone?: PillTone; style?: React.CSSProperties }) {
  const tones: Record<PillTone, { bg: string; c: string }> = {
    default: { bg: 'var(--bg-2)', c: 'var(--ink-2)' },
    sage: { bg: 'var(--sage-soft)', c: 'var(--sage)' },
    lavender: { bg: 'var(--lavender-soft)', c: 'var(--lavender)' },
    ghost: { bg: 'transparent', c: 'var(--muted)' },
  };
  const t = tones[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: t.bg, color: t.c,
      fontSize: 12, fontWeight: 500, ...style,
    }}>
      {children}
    </span>
  );
}

// ── Button ─────────────────────────────────────────────────────────────────────
type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export function Button({
  children, tone = 'primary', size = 'md', onClick, style = {}, full = false,
}: {
  children: React.ReactNode; tone?: ButtonTone; size?: ButtonSize;
  onClick?: () => void; style?: React.CSSProperties; full?: boolean;
}) {
  const sizes: Record<ButtonSize, { p: string; fs: number; r: number }> = {
    sm: { p: '7px 14px', fs: 13, r: 10 },
    md: { p: '11px 20px', fs: 14, r: 12 },
    lg: { p: '15px 26px', fs: 15, r: 14 },
  };
  const toneStyles: Record<ButtonTone, { bg: string; c: string; bd?: string }> = {
    primary: { bg: 'var(--sage)', c: '#FBF8F0' },
    secondary: { bg: 'var(--bg-2)', c: 'var(--ink)' },
    ghost: { bg: 'transparent', c: 'var(--ink)', bd: 'var(--line)' },
    danger: { bg: 'var(--alert)', c: '#FBF8F0' },
  };
  const s = sizes[size];
  const t = toneStyles[tone];
  return (
    <button
      onClick={onClick}
      style={{
        padding: s.p, fontSize: s.fs, borderRadius: s.r,
        background: t.bg, color: t.c,
        border: `1px solid ${t.bd || 'transparent'}`,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
        gap: 8, justifyContent: 'center', fontWeight: 500,
        width: full ? '100%' : undefined,
        transition: 'transform .12s, opacity .15s, background .2s',
        ...style,
      }}
      onMouseDown={e => (e.currentTarget.style.transform = 'scale(.97)')}
      onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  );
}

// ── Logo ───────────────────────────────────────────────────────────────────────
// The मनmate mark — a heart formed by two faces leaning together. Rendered on its
// own (no frame); `size` is the rendered height, width follows the aspect ratio.
export function Logo({ size = 44 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="मनmate"
      style={{ height: size, width: 'auto', display: 'block', userSelect: 'none', flexShrink: 0 }}
      draggable={false}
    />
  );
}

// ── Wordmark ─────────────────────────────────────────────────────────────────────
// "मन" (mind, in Devanagari sage) joined to an italic serif "mate".
export function Wordmark({ size = 19 }: { size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', lineHeight: 1, whiteSpace: 'nowrap' }}>
      <span style={{
        fontFamily: '"Noto Sans Devanagari", sans-serif',
        fontWeight: 600, fontSize: size * 1.02,
        color: 'var(--sage)', letterSpacing: -0.2,
      }}>मन</span>
      <span className="serif" style={{
        fontSize: size, fontWeight: 500, fontStyle: 'italic',
        color: 'var(--ink)', letterSpacing: -0.3, marginLeft: 1,
      }}>mate</span>
    </span>
  );
}

// ── Global Header ──────────────────────────────────────────────────────────────
export interface UserInfo {
  name: string;
  email?: string;
  role?: string;
}

export function GlobalHeader({ user }: { user: UserInfo | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = React.useState(false);
  const [dropOpen, setDropOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const dropRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!dropOpen) return;
    const handle = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [dropOpen]);

  const dashboardPath = getRoleDashboard(user?.role);
  const links = [
    { id: '/', label: 'Home' },
    { id: dashboardPath, label: 'Dashboard' },
    { id: '/therapists', label: 'Therapists' },
    { id: '/blogs', label: 'Blogs', badge: 'New' },
    { id: '/community', label: 'Community', badge: 'Soon' },
  ];

  const displayUser = user || { name: 'Guest' };
  const role = user?.role;
  const roleLabel: Record<string, string> = { admin: 'Admin', therapist: 'Therapist', listener: 'Listener', client: 'Client', user: 'Client' };

  const navigate = (path: string) => { setDropOpen(false); router.push(path); };
  const signOut = () => { if (typeof window !== 'undefined') { localStorage.clear(); sessionStorage.clear(); } navigate('/auth/login'); };

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 30,
      padding: 'clamp(12px, 2.5vw, 18px) clamp(16px, 4vw, 48px)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 0,
      background: 'color-mix(in oklab, var(--bg) 82%, transparent)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid var(--line-2)',
    }}>

      {/* Left group: hamburger (mobile only) + logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="hdr-menu-btn" onClick={() => setMobileOpen(o => !o)} aria-label="Menu">
          {mobileOpen
            ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
          }
        </button>
        <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <Logo size={42} />
          <Wordmark size={20} />
        </div>
      </div>

      {/* Centre nav – hidden on mobile */}
      <nav className="hdr-nav">
        {links.map(l => {
          const active = mounted && pathname === l.id;
          const lWithBadge = l as typeof l & { badge?: string };
          return (
            <button key={l.id} onClick={() => router.push(l.id)} style={{
              padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: active ? 'var(--card)' : 'transparent',
              color: active ? 'var(--ink)' : 'var(--muted)',
              fontSize: 14, fontWeight: 500,
              boxShadow: active ? '0 1px 3px rgba(0,0,0,.04), inset 0 0 0 1px var(--line)' : 'none',
              transition: 'all .2s',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              {l.label}
              {lWithBadge.badge && (
                <span style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  padding: '2px 6px', borderRadius: 999,
                  background: lWithBadge.badge === 'New' ? '#EBF4F7' : 'var(--bg-2)',
                  color: lWithBadge.badge === 'New' ? '#4A7C8E' : 'var(--muted)',
                  border: lWithBadge.badge === 'New' ? '1px solid #BFD3DB' : '1px solid var(--line)',
                  lineHeight: 1,
                }}>
                  {lWithBadge.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Right: profile dropdown */}
      <div ref={dropRef} style={{ position: 'relative' }}>
        <button onClick={() => user ? setDropOpen(o => !o) : navigate('/auth/login')} className="hdr-profile-btn" style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px 6px 6px', borderRadius: 999,
          background: 'var(--card)', border: '1px solid var(--line)',
          cursor: 'pointer', color: 'var(--ink)', fontSize: 13,
          boxShadow: dropOpen ? '0 0 0 2px var(--sage-soft)' : 'none',
          transition: 'box-shadow 0.15s',
        }}>
          <Avatar name={displayUser.name} size={30} />
          <span className="hdr-uname" style={{ fontWeight: 500 }}>{displayUser.name.split(' ')[0]}</span>
          <svg className="hdr-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, transition: 'transform 0.2s', transform: dropOpen ? 'rotate(180deg)' : 'none', color: 'var(--muted)' }}><path d="M6 9l6 6 6-6"/></svg>
        </button>

        {dropOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0,
            width: 240, background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 16, boxShadow: '0 8px 32px rgba(0,0,0,0.12)', zIndex: 50,
            overflow: 'hidden', animation: 'dropDown 0.15s ease',
          }}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--line-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={displayUser.name} size={36} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{displayUser.name}</div>
                  {user?.email && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{user.email}</div>}
                </div>
              </div>
              {role && (
                <div style={{ marginTop: 10, display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: role === 'admin' ? 'var(--peach)' : 'var(--sage-soft)', color: role === 'admin' ? '#7A4A2E' : 'var(--sage)', fontSize: 11, fontWeight: 600, letterSpacing: 0.6 }}>
                  {roleLabel[role] || 'Client'}
                </div>
              )}
            </div>
            <div style={{ padding: '8px 0' }}>
              <DropItem icon={<DashIcon />} label="Dashboard" onClick={() => navigate(dashboardPath)} />
              <DropItem icon={<ProfileIcon />} label="My Profile" onClick={() => navigate('/profile')} />
              <DropItem icon={<CallIcon />} label="AI Companion" onClick={() => navigate('/ai-call')} />
              <DropItem icon={<TherapistIcon />} label="Find Therapists" onClick={() => navigate('/therapists')} />
              <DropItem icon={<CommunityIcon />} label="Community" onClick={() => navigate('/community')} badge="Soon" />
              <DropItem icon={<BlogsIcon />} label="Blogs" onClick={() => navigate('/blogs')} badge="New" />
              {role === 'admin' && (
                <>
                  <div style={{ height: 1, background: 'var(--line-2)', margin: '6px 12px' }} />
                  <DropItem icon={<AdminIcon />} label="Admin Dashboard" onClick={() => navigate('/admin')} highlight />
                </>
              )}
              <div style={{ height: 1, background: 'var(--line-2)', margin: '6px 12px' }} />
              <DropItem icon={<SignOutIcon />} label="Sign out" onClick={signOut} danger />
            </div>
          </div>
        )}
      </div>

      {/* Mobile nav – full-width row below header via flex-wrap */}
      {mobileOpen && (
        <div className="hdr-mobile">
          {links.map(l => {
            const active = mounted && pathname === l.id;
            const lWithBadge = l as typeof l & { badge?: string };
            return (
              <button key={l.id} className={`hdr-mobile-link${active ? ' active' : ''}`}
                onClick={() => { router.push(l.id); setMobileOpen(false); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {l.label}
                {lWithBadge.badge && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.6,
                    textTransform: 'uppercase', padding: '2px 6px', borderRadius: 999,
                    background: lWithBadge.badge === 'New' ? '#EBF4F7' : 'var(--bg-2)',
                    color: lWithBadge.badge === 'New' ? '#4A7C8E' : 'var(--muted)',
                    border: lWithBadge.badge === 'New' ? '1px solid #BFD3DB' : '1px solid var(--line)',
                    lineHeight: 1,
                  }}>
                    {lWithBadge.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <style>{`@keyframes dropDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }`}</style>
    </header>
  );
}

function DropItem({ icon, label, onClick, danger, highlight, badge }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; highlight?: boolean; badge?: string }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
      background: hov ? (danger ? 'rgba(178,107,92,0.08)' : highlight ? 'rgba(122,74,46,0.07)' : 'var(--bg)') : 'transparent',
      color: danger ? 'var(--alert)' : highlight ? '#7A4A2E' : 'var(--ink)',
      fontSize: 13, fontWeight: 500, transition: 'background 0.12s',
    }}>
      <span style={{ opacity: 0.7, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
          padding: '2px 6px', borderRadius: 999, lineHeight: 1,
          background: badge === 'New' ? '#EBF4F7' : 'var(--bg-2)',
          color: badge === 'New' ? '#4A7C8E' : 'var(--muted)',
          border: badge === 'New' ? '1px solid #BFD3DB' : '1px solid var(--line)',
        }}>{badge}</span>
      )}
    </button>
  );
}

function DashIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function ProfileIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function CallIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3"/></svg>; }
function TherapistIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function AdminIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>; }
function SignOutIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
function CommunityIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>; }
function BlogsIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
