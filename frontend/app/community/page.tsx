'use client';
import React, { useEffect, useState } from 'react';
import { GlobalHeader } from '@/components/design/primitives';
import { getCurrentUser } from '@/lib/api';

export default function CommunityPage() {
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSubmitted(true);
  };

  const features = [
    { label: 'Anonymous Forums', hi: 'अनाम फ़ोरम' },
    { label: 'Peer Groups', hi: 'साथी समूह' },
    { label: 'Shared Stories', hi: 'साझा कहानियाँ' },
    { label: 'Weekly Prompts', hi: 'साप्ताहिक विषय' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <GlobalHeader user={user} />

      {/* Ambient background blobs */}
      <div aria-hidden style={{
        position: 'fixed', top: -200, right: -100, width: 640, height: 640,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, #BFD3DB, transparent 70%)',
        opacity: 0.45, pointerEvents: 'none', zIndex: 0,
      }} />
      <div aria-hidden style={{
        position: 'fixed', bottom: -200, left: -120, width: 560, height: 560,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, var(--lavender-soft), transparent 70%)',
        opacity: 0.55, pointerEvents: 'none', zIndex: 0,
      }} />

      {/* Main coming-soon content */}
      <main style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(48px, 10vw, 100px) clamp(20px, 5vw, 48px)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 560, animation: 'fadeUp 0.6s both' }}>

          {/* Kicker pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 999,
            background: '#EBF4F7', color: '#4A7C8E',
            fontSize: 11, fontWeight: 600, letterSpacing: 1.2,
            textTransform: 'uppercase', marginBottom: 28,
            border: '1px solid #BFD3DB',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A7C8E', opacity: 0.7 }} />
            Coming Soon
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 6 }}>
            <span style={{
              display: 'block', fontFamily: 'Geist, sans-serif',
              fontSize: 13, color: 'var(--muted)', letterSpacing: 2,
              textTransform: 'uppercase', marginBottom: 10,
            }}>समुदाय</span>
            <h1 className="serif" style={{
              fontSize: 'clamp(48px, 10vw, 80px)', lineHeight: 1.0,
              fontWeight: 400, letterSpacing: -0.025, margin: 0,
              color: 'var(--ink)',
            }}>
              Community
            </h1>
          </div>

          {/* Sub-line */}
          <p style={{
            fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.65,
            margin: '24px auto 0', maxWidth: 420,
          }}>
            A safe, anonymous space to share your journey, hear others&apos; stories,
            and grow — together.
          </p>

          {/* Divider */}
          <div style={{
            width: 48, height: 1, background: 'var(--line)',
            margin: '36px auto',
          }} />

          {/* Feature preview chips */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 10,
            justifyContent: 'center', marginBottom: 44,
          }}>
            {features.map(f => (
              <div key={f.label} style={{
                padding: '8px 16px', borderRadius: 999,
                border: '1px solid var(--line)',
                background: 'var(--card)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, color: 'var(--ink-2)',
              }}>
                {f.label}
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.hi}</span>
              </div>
            ))}
          </div>

          {/* Email notify form */}
          {!submitted ? (
            <form onSubmit={handleNotify} style={{
              display: 'flex', gap: 10, maxWidth: 400, margin: '0 auto',
              flexWrap: 'wrap', justifyContent: 'center',
            }}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={{
                  flex: 1, minWidth: 200,
                  padding: '12px 18px', borderRadius: 12,
                  border: '1px solid var(--line)',
                  background: 'var(--card)',
                  fontSize: 14, color: 'var(--ink)',
                  outline: 'none',
                }}
              />
              <button type="submit" style={{
                padding: '12px 22px', borderRadius: 12,
                border: 'none', background: '#4A7C8E', color: '#fff',
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
                Notify me
              </button>
            </form>
          ) : (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '12px 22px', borderRadius: 12,
              background: 'var(--sage-soft)', color: 'var(--sage)',
              fontSize: 14, fontWeight: 500,
              animation: 'fadeUp 0.3s both',
            }}>
              <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              You&apos;re on the list — we&apos;ll reach out soon.
            </div>
          )}

          {/* Fine print */}
          <p style={{ marginTop: 20, fontSize: 12, color: 'var(--muted)' }}>
            No spam. Unsubscribe any time.
          </p>
        </div>
      </main>
    </div>
  );
}
