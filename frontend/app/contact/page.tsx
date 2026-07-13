'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark } from '@/components/design/primitives';
import { getCurrentUser, getRoleDashboard } from '@/lib/api';

const CONTACTS = [
  { label: 'General support', value: 'business.mannmate@gmail.com' },
  { label: 'Privacy enquiries', value: 'business.mannmate@gmail.com' },
  { label: 'Press & partnerships', value: 'business.mannmate@gmail.com' },
];

export default function ContactPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const dashboardPath = user ? getRoleDashboard(user.role) : '/';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,241,232,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)', padding: '0 clamp(16px, 4vw, 48px)', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={40} />
          <Wordmark size={18} />
        </button>
        <div style={{ display: 'flex', gap: 10 }}>
          {user
            ? <button onClick={() => router.push(dashboardPath)} style={navBtnStyle}>Dashboard</button>
            : <>
                <button onClick={() => router.push('/auth/login')} style={navBtnStyle}>Sign in</button>
                <button onClick={() => router.push('/auth/register')} style={{ ...navBtnStyle, background: 'var(--sage)', color: '#FBF8F0', border: 'none' }}>Get started</button>
              </>
          }
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage-2) 100%)',
        padding: '72px 48px 56px', textAlign: 'center', color: '#F5F1E8',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.7, fontWeight: 600, marginBottom: 16 }}>Get in touch</div>
        <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, margin: '0 0 16px', letterSpacing: -0.02, lineHeight: 1.1 }}>
          Contact Us
        </h1>
        <p style={{ fontSize: 16, opacity: 0.8, maxWidth: 540, margin: '0 auto', lineHeight: 1.6 }}>
          Questions, feedback, or partnership enquiries — we read every message.
        </p>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '64px 32px 100px' }}>

        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 16, padding: '28px 32px', marginBottom: 32,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20,
        }}>
          {CONTACTS.map(c => (
            <div key={c.label}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, marginBottom: 4 }}>{c.label.toUpperCase()}</div>
              <a href={`mailto:${c.value}`} style={linkStyle}>{c.value}</a>
            </div>
          ))}
        </div>

        <section style={{ marginBottom: 32 }}>
          <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, color: 'var(--ink)', margin: '0 0 12px' }}>Registered office</h2>
          <p style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.75, margin: 0 }}>
            MannMate Technologies Private Limited<br />
            Bengaluru, Karnataka — 560001<br />
            India
          </p>
        </section>

        <section style={{
          background: 'var(--sage-soft)', border: '1px solid rgba(107,91,149,0.12)',
          borderRadius: 16, padding: '24px 28px',
        }}>
          <h2 className="serif" style={{ fontSize: 20, fontWeight: 400, color: 'var(--ink)', margin: '0 0 8px' }}>In a crisis?</h2>
          <p style={{ fontSize: 14.5, color: 'var(--ink-2)', lineHeight: 1.7, margin: 0 }}>
            If you are experiencing a mental health emergency or are in immediate danger, please contact your local emergency services or a crisis helpline right away — this page is for general enquiries and is not monitored for emergencies.
          </p>
        </section>

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, fontSize: 13 }}>
            <a href="/privacy" style={linkStyle}>Privacy Policy</a>
            <span style={{ color: 'var(--muted)' }}>·</span>
            <a href="/terms" style={linkStyle}>Terms &amp; Conditions</a>
            <span style={{ color: 'var(--muted)' }}>·</span>
            <button onClick={() => router.push('/')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Return home</button>
          </div>
        </div>

      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)',
  background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--sage)', textDecoration: 'underline', textDecorationColor: 'transparent',
  fontSize: 14,
};
