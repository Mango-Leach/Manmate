'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Avatar, Pill, Button, Logo, Wordmark, GlobalHeader, type UserInfo } from './primitives';
import { Orb } from './Orb';
import { getCurrentUser } from '@/lib/api';

/** Routes that require the user to be logged in */
const PROTECTED_ROUTES = ['/peer-call', '/ai-call'];

/**
 * Navigate to a route. If the route is protected and the user is not logged
 * in, redirect to the login page with a `redirect` query-param so the user
 * lands on the intended page after signing in.
 */
function useGuardedRouter() {
  const router = useRouter();
  return (route: string) => {
    if (PROTECTED_ROUTES.includes(route) && !getCurrentUser()) {
      router.push(`/auth/login?redirect=${encodeURIComponent(route)}`);
    } else {
      router.push(route);
    }
  };
}

export function Homepage({ user }: { user: UserInfo | null }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <GlobalHeader user={user} />
      <HeroEmotion />
      <ThreePaths />
      <FeatureHighlights />
      <HowItWorks />
      <TherapistPreview />
      <Testimonials />
      <FooterCTA />
      <SiteFooter />
    </div>
  );
}

function HeroEmotion() {
  const navigateTo = useGuardedRouter();
  const [mood, setMood] = React.useState<string | null>(null);
  const moods = [
    { id: 'anxious', label: 'Anxious', hi: 'चिंतित' },
    { id: 'low', label: 'Low', hi: 'उदास' },
    { id: 'overwhelmed', label: 'Overwhelmed', hi: 'बहुत भारी' },
    { id: 'lonely', label: 'Lonely', hi: 'अकेला' },
    { id: 'numb', label: 'Numb', hi: 'सुन्न' },
    { id: 'okay', label: 'Just want to talk', hi: 'बात करना है' },
  ];
  const recommendations: Record<string, { primary: string; reason: string }> = {
    anxious: { primary: 'ai', reason: 'Serenity can guide you through grounding right now.' },
    low: { primary: 'listener', reason: 'A peer listener can simply be with you.' },
    overwhelmed: { primary: 'ai', reason: 'Try a short breathing session with Serenity first.' },
    lonely: { primary: 'listener', reason: 'Connect with a human who is ready to listen.' },
    numb: { primary: 'therapist', reason: 'A licensed therapist can help unpack this.' },
    okay: { primary: 'listener', reason: 'A listener will make space for the conversation.' },
  };

  const handleContinue = () => {
    if (!mood) return;
    const r = recommendations[mood].primary;
    if (r === 'ai') navigateTo('/ai-call');
    else if (r === 'therapist') navigateTo('/therapists');
    else navigateTo('/peer-call');
  };

  return (
    <section className="section-padding" style={{ position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{
        position: 'absolute', top: -200, right: -100, width: 720, height: 720,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, var(--sage-soft), transparent 70%)',
        opacity: 0.8, pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -300, left: -150, width: 640, height: 640,
        borderRadius: '50%',
        background: 'radial-gradient(closest-side, var(--lavender-soft), transparent 70%)',
        opacity: 0.7, pointerEvents: 'none',
      }} />
      <div className="hero-grid" style={{ maxWidth: 1200, margin: '0 auto', position: 'relative' }}>
        <div>
          <Pill tone="sage" style={{ marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)' }} />
            Mental health support, whenever you need it
          </Pill>
          <h1 className="serif" style={{
            fontSize: 'clamp(38px, 8vw, 76px)', lineHeight: 1.02, fontWeight: 400,
            letterSpacing: -0.02, margin: '0 0 24px', color: 'var(--ink)',
          }}>
            How are you<br />
            arriving <em style={{ fontStyle: 'italic', color: 'var(--sage)' }}>today</em>?
          </h1>
          <p style={{
            fontSize: 19, lineHeight: 1.55, color: 'var(--ink-2)',
            maxWidth: 520, margin: '0 0 36px',
          }}>
            There&apos;s no wrong way to feel. Tell us where you are right now,
            and we&apos;ll meet you there — with an AI companion, a real human listener,
            or a licensed therapist.
          </p>
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase',
              color: 'var(--muted)', marginBottom: 14, fontWeight: 500,
            }}>Right now I feel…</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {moods.map(m => {
                const active = mood === m.id;
                return (
                  <button key={m.id} onClick={() => setMood(m.id)} style={{
                    padding: '12px 20px', borderRadius: 999,
                    border: `1px solid ${active ? 'var(--sage)' : 'var(--line)'}`,
                    background: active ? 'var(--sage-soft)' : 'var(--card)',
                    color: active ? 'var(--sage)' : 'var(--ink-2)',
                    cursor: 'pointer', fontSize: 14, fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 8,
                    transition: 'all 0.2s',
                  }}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          {mood && (
            <div className="fade-in" style={{
              padding: 20, background: 'var(--card)',
              borderRadius: 18, border: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: 18,
              maxWidth: 560, marginTop: 16,
            }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: 'var(--sage-soft)', color: 'var(--sage)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>{Icon.sparkle(22)}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 2 }}>We hear you.</div>
                <div style={{ fontSize: 15, color: 'var(--ink)' }}>{recommendations[mood].reason}</div>
              </div>
              <Button tone="primary" size="sm" onClick={handleContinue}>Continue</Button>
            </div>
          )}
        </div>

        <div className="orb-col">
          <div className="orb-inner">
            <Orb size={340} state="idle" orbStyle="aurora" />
            <FloatingLabel style={{ position: 'absolute', top: -10, right: -20 }} delay={0.2}>
              {Icon.sparkle(14)} Voice AI · 24/7
            </FloatingLabel>
            <FloatingLabel style={{ position: 'absolute', bottom: 40, left: -40 }} delay={0.6} tone="lavender">
              {Icon.users(14)} Listeners available
            </FloatingLabel>
            <FloatingLabel style={{ position: 'absolute', bottom: -20, right: 10 }} delay={1.0} tone="peach">
              {Icon.heart(14)} Community launching soon
            </FloatingLabel>
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatingLabel({
  children, delay = 0, tone = 'sage', style = {},
}: {
  children: React.ReactNode; delay?: number; tone?: 'sage' | 'lavender' | 'peach'; style?: React.CSSProperties;
}) {
  const tones = {
    sage: { bg: 'var(--card)', c: 'var(--sage)', bd: 'var(--sage-soft)' },
    lavender: { bg: 'var(--card)', c: 'var(--lavender)', bd: 'var(--lavender-soft)' },
    peach: { bg: 'var(--card)', c: 'var(--ink-2)', bd: 'var(--peach)' },
  };
  const t = tones[tone];
  return (
    <div style={{
      ...style,
      background: t.bg, border: `1px solid ${t.bd}`, color: t.c,
      padding: '10px 16px', borderRadius: 999,
      fontSize: 13, fontWeight: 500,
      display: 'flex', alignItems: 'center', gap: 8,
      boxShadow: '0 10px 30px rgba(31,42,36,0.08)',
      animation: `float 5s ${delay}s infinite ease-in-out`,
      whiteSpace: 'nowrap',
    }}>
      {children}
    </div>
  );
}

function ThreePaths() {
  const navigateTo = useGuardedRouter();
  const paths = [
    {
      id: 'ai', kicker: '01 — Right now', title: 'Talk to Serenity', hi: 'सेरेनिटी से बात करें',
      desc: 'A voice-based AI companion trained in grounding techniques. No waiting, no judgment. Available 24/7 in Hindi or English.',
      stat: 'Available now', route: '/ai-call', tone: 'sage', icon: Icon.sparkle(22),
      badge: null,
    },
    {
      id: 'listener', kicker: '02 — Peer support', title: 'Connect with a Listener', hi: 'श्रोता से जुड़ें',
      desc: 'Real volunteer humans — trained peer supporters ready to listen. Matched automatically via live voice call.',
      stat: 'Connect now', route: '/peer-call', tone: 'lavender', icon: Icon.users(22),
      badge: null,
    },
    {
      id: 'therapist', kicker: '03 — Professional care', title: 'Book a Therapist', hi: 'चिकित्सक से मिलें',
      desc: 'Licensed, verified professionals. Google Meet sessions, email and WhatsApp reminders, and a wallet that makes booking easy.',
      stat: 'Book a session', route: '/therapists', tone: 'peach', icon: Icon.calendar(22),
      badge: null,
    },
    {
      id: 'community', kicker: '04 — Together', title: 'Join the Community', hi: 'समुदाय से जुड़ें',
      desc: 'Share your journey with people who understand. Anonymous discussion boards, peer-led support groups, and shared stories — healing together is powerful.',
      stat: 'Coming soon', route: '/community', tone: 'sky', icon: Icon.heart(22),
      badge: 'New',
    },
  ];
  return (
    <section className="section-padding" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <Pill tone="default" style={{ marginBottom: 16 }}>Everything you need</Pill>
        <h2 className="serif" style={{
          fontSize: 'clamp(28px, 5vw, 48px)', lineHeight: 1.05,
          fontWeight: 400, margin: '0 0 16px', letterSpacing: -0.015,
        }}>
          Four ways we can <em style={{ fontStyle: 'italic', color: 'var(--sage)' }}>support you.</em>
        </h2>
        <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
          From instant AI guidance to human connection and professional care — meet us wherever you are.
        </p>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: 20,
      }}>
        {paths.map((p, i) => <PathCard key={p.id} path={p} onNav={navigateTo} delay={i * 0.1} />)}
      </div>
    </section>
  );
}

function FeatureHighlights() {
  const features = [
    {
      icon: (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
      title: 'Mood Journal',
      hi: 'मूड डायरी',
      desc: 'Track your emotional patterns daily. Spot triggers and celebrate progress over time.',
      color: '#7D9B86',
      bg: 'var(--sage-soft)',
    },
    {
      icon: (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      title: 'Session History',
      hi: 'सत्र इतिहास',
      desc: 'Revisit your past sessions — calls, chats, and appointments — all in one place.',
      color: 'var(--lavender)',
      bg: 'var(--lavender-soft)',
    },
    {
      icon: (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012 .09h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
        </svg>
      ),
      title: 'Crisis Helplines',
      hi: 'संकट हेल्पलाइन',
      desc: 'Instant access to iCall, Vandrevala, and Snehi — verified Indian crisis numbers, always visible.',
      color: '#C0705A',
      bg: '#FDF0EC',
    },
    {
      icon: (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      ),
      title: 'Private & Safe',
      hi: 'निजी और सुरक्षित',
      desc: 'End-to-end encrypted calls, anonymous peer matching, no data sold — ever.',
      color: '#4A7C8E',
      bg: '#EBF4F7',
    },
    {
      icon: (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/><path d="M12 12v9"/><path d="M9 15l3 3 3-3"/>
        </svg>
      ),
      title: 'Become a Listener',
      hi: 'श्रोता बनें',
      desc: 'Give back by supporting others. Apply to join our trained volunteer listener network.',
      color: '#8A7AB5',
      bg: 'var(--lavender-soft)',
    },
    {
      icon: (
        <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
        </svg>
      ),
      title: 'Hindi & English',
      hi: 'हिंदी और अंग्रेज़ी',
      desc: 'Full bilingual support — switch languages mid-session, or speak in both. We understand you.',
      color: '#7D9B86',
      bg: 'var(--sage-soft)',
    },
  ];

  return (
    <section className="section-padding" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <Pill tone="default" style={{ marginBottom: 16 }}>Built for real life</Pill>
        <h2 className="serif" style={{
          fontSize: 'clamp(24px, 4vw, 40px)', lineHeight: 1.1,
          fontWeight: 400, margin: 0, letterSpacing: -0.01,
        }}>
          More than just conversations.
        </h2>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        {features.map((f, i) => (
          <div key={f.title} style={{
            padding: '22px 24px',
            background: 'var(--card)',
            border: '1px solid var(--line)',
            borderRadius: 20,
            display: 'flex', flexDirection: 'column', gap: 12,
            animation: `fadeUp 0.5s ${i * 0.07}s both`,
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13,
              background: f.bg, color: f.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {f.icon}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="serif" style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)' }}>{f.title}</span>
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PathCard({ path, onNav, delay = 0 }: { path: { id: string; kicker: string; title: string; hi: string; desc: string; stat: string; route: string; tone: string; icon: React.ReactNode; badge: string | null }; onNav: (r: string) => void; delay?: number }) {
  const [hover, setHover] = React.useState(false);
  const toneBg: Record<string, string> = {
    sage: 'var(--sage-soft)',
    lavender: 'var(--lavender-soft)',
    peach: 'linear-gradient(135deg, var(--peach) 0%, #E8C7A8 100%)',
    sky: '#EBF4F7',
  };
  const toneC: Record<string, string> = {
    sage: 'var(--sage)', lavender: 'var(--lavender)', peach: 'var(--ink-2)', sky: '#4A7C8E',
  };
  const toneArrow: Record<string, string> = {
    sage: 'var(--sage)', lavender: 'var(--lavender)', peach: '#C0705A', sky: '#4A7C8E',
  };
  return (
    <div
      onClick={() => onNav(path.route)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 24, padding: '28px 24px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'all 0.25s ease',
        transform: hover ? 'translateY(-4px)' : 'none',
        boxShadow: hover ? '0 20px 40px rgba(31,42,36,0.08)' : '0 1px 2px rgba(31,42,36,0.02)',
        minHeight: 340,
        animation: `fadeUp 0.5s ${delay}s both`,
        position: 'relative',
      }}
    >
      {path.badge && (
        <span style={{
          position: 'absolute', top: 20, right: 20,
          background: '#EBF4F7', color: '#4A7C8E',
          fontSize: 10, fontWeight: 600, letterSpacing: 0.8,
          textTransform: 'uppercase', padding: '3px 8px', borderRadius: 999,
          border: '1px solid #BFD3DB',
        }}>{path.badge}</span>
      )}
      <div style={{
        fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase',
        color: 'var(--muted)', marginBottom: 24, fontWeight: 500,
      }}>{path.kicker}</div>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: toneBg[path.tone], color: toneC[path.tone],
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28,
      }}>{path.icon}</div>
      <h3 className="serif" style={{ fontSize: 26, lineHeight: 1.1, fontWeight: 400, letterSpacing: -0.01, margin: '0 0 16px' }}>
        {path.title}
      </h3>
      <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 auto', paddingBottom: 24 }}>
        {path.desc}
      </p>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 20, borderTop: '1px solid var(--line-2)',
      }}>
        <span style={{ fontSize: 13, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          {path.id === 'ai' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)', animation: 'pulse 2s infinite' }} />}
          {path.id === 'community' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4A7C8E', opacity: 0.7 }} />}
          {path.stat}
        </span>
        <span style={{
          width: 34, height: 34, borderRadius: '50%',
          background: hover ? toneArrow[path.tone] : 'var(--bg-2)',
          color: hover ? '#fff' : 'var(--ink-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s',
        }}>{Icon.arrow(14)}</span>
      </div>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { n: '01', title: 'Sign in securely', desc: 'Google or email OTP. Your data is private and encrypted end-to-end.' },
    { n: '02', title: 'Choose your support', desc: 'Talk to Serenity, connect with a human listener, or book a therapist.' },
    { n: '03', title: 'Get reminders', desc: 'Email and WhatsApp nudges 24 hours and 30 minutes before your session.' },
    { n: '04', title: 'Meet on Google Meet', desc: 'Therapist sessions use auto-generated Meet links — no app to install.' },
  ];
  return (
    <section className="section-padding" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div className="g-how">
        <div>
          <Pill tone="default" style={{ marginBottom: 20 }}>How it works</Pill>
          <h2 className="serif" style={{ fontSize: 'clamp(28px, 5vw, 48px)', lineHeight: 1.05, fontWeight: 400, margin: 0, letterSpacing: -0.015 }}>
            From <em style={{ fontStyle: 'italic' }}>overwhelmed</em> to<br />heard, in four steps.
          </h2>
          <p style={{ marginTop: 20, fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 360 }}>
            No downloads, no paperwork. Care that meets you where you are, at the speed you need it.
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {steps.map((s, i) => (
            <div key={s.n} style={{
              display: 'grid', gridTemplateColumns: '80px 1fr',
              padding: '24px 0',
              borderTop: i === 0 ? '1px solid var(--line)' : 'none',
              borderBottom: '1px solid var(--line)',
              gap: 20, alignItems: 'start',
            }}>
              <div className="serif" style={{ fontSize: 32, color: 'var(--sage)', fontWeight: 400, letterSpacing: -0.01 }}>{s.n}</div>
              <div>
                <div className="serif" style={{ fontSize: 22, marginBottom: 6, fontWeight: 500 }}>{s.title}</div>
                <div style={{ fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.5 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type AvatarToneType = 'sage' | 'lavender' | 'peach';
const CARD_TONES: AvatarToneType[] = ['sage', 'lavender', 'peach'];

interface LiveTherapist {
  id: string;
  name: string;
  title?: string;
  specialties?: string[];
  rating?: number;
}

function TherapistPreview() {
  const router = useRouter();
  const [therapists, setTherapists] = React.useState<LiveTherapist[]>([]);
  const [total, setTotal] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    fetch(`${API_URL}/api/therapists`)
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setTotal(json.data.length);
          setTherapists(json.data.slice(0, 3));
        }
      })
      .catch(() => { /* silently ignore — section just stays empty */ })
      .finally(() => setLoading(false));
  }, []);

  const skeletonStyle: React.CSSProperties = {
    background: 'var(--card)', borderRadius: 20,
    border: '1px solid var(--line)', padding: 24,
    display: 'flex', flexDirection: 'column', gap: 14,
    animation: 'pulse 1.5s infinite',
  };

  return (
    <section className="section-padding" style={{ background: 'var(--bg-2)', margin: '40px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="flex-sb" style={{ marginBottom: 32 }}>
          <div>
            <Pill tone="sage" style={{ marginBottom: 16 }}>Verified therapists</Pill>
            <h2 className="serif" style={{ fontSize: 'clamp(26px, 5vw, 44px)', margin: 0, fontWeight: 400, letterSpacing: -0.01 }}>
              Handpicked professionals,<br />ready when you are.
            </h2>
          </div>
          <Button tone="ghost" onClick={() => router.push('/therapists')}>
            Browse all {total !== null ? total : '…'} therapists {Icon.arrow(14)}
          </Button>
        </div>

        <div className="g3">
          {loading ? (
            /* Loading skeletons */
            [0, 1, 2].map(i => (
              <div key={i} style={skeletonStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--line)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 16, borderRadius: 8, background: 'var(--line)', marginBottom: 8, width: '70%' }} />
                    <div style={{ height: 12, borderRadius: 8, background: 'var(--line)', width: '50%' }} />
                  </div>
                </div>
                <div style={{ height: 28, borderRadius: 999, background: 'var(--line)', width: 120 }} />
                <div style={{ height: 1, background: 'var(--line-2)' }} />
                <div style={{ height: 20, borderRadius: 8, background: 'var(--line)', width: '40%' }} />
              </div>
            ))
          ) : therapists.length === 0 ? (
            /* Empty state */
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: 15 }}>
              No therapists available yet. <button onClick={() => router.push('/therapists')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontWeight: 500, fontSize: 15 }}>Check back soon →</button>
            </div>
          ) : (
            therapists.map((t, i) => {
              const tone = CARD_TONES[i % CARD_TONES.length];
              const spec = t.specialties?.join(' · ') || t.title || 'General Therapy';
              return (
                <div key={t.id} style={{
                  background: 'var(--card)', borderRadius: 20,
                  border: '1px solid var(--line)', padding: 24,
                  display: 'flex', flexDirection: 'column', gap: 14,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Avatar name={t.name} tone={tone} size={56} />
                    <div>
                      <div className="serif" style={{ fontSize: 18, fontWeight: 500 }}>{t.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{spec}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Pill tone="sage">Available today</Pill>
                    {t.title && <Pill>{t.title}</Pill>}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    paddingTop: 8, borderTop: '1px solid var(--line-2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--ink-2)', fontSize: 13 }}>
                      {Icon.star(14, 'var(--peach)')} {t.rating?.toFixed(1) ?? '—'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    { q: 'I called Serenity at 2am during a panic attack. I don\'t know what I would have done without it.', a: 'Aditi, 24' },
    { q: 'The listener I was matched with just let me cry. No fixing, no advice. It was exactly what I needed.', a: 'Vikram, 31' },
    { q: 'Booking Dr. Mehra took two minutes. The Meet link showed up in my WhatsApp an hour before.', a: 'Sneha, 28' },
  ];
  return (
    <section className="section-padding" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <Pill style={{ marginBottom: 16 }}>From the people we&apos;ve held</Pill>
        <h2 className="serif" style={{ fontSize: 'clamp(26px, 5vw, 44px)', margin: 0, fontWeight: 400, letterSpacing: -0.01 }}>
          Words from real sessions.
        </h2>
      </div>
      <div className="g3">
        {quotes.map((t, i) => (
          <div key={i} style={{ padding: 28, background: 'var(--card)', borderRadius: 20, border: '1px solid var(--line)' }}>
            <div className="serif" style={{ fontSize: 40, lineHeight: 0.5, color: 'var(--sage)', marginBottom: 16 }}>&ldquo;</div>
            <p className="serif" style={{ fontSize: 19, lineHeight: 1.45, margin: 0, color: 'var(--ink)', fontWeight: 400, letterSpacing: -0.005 }}>
              {t.q}
            </p>
            <div style={{ marginTop: 24, fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 20, height: 1, background: 'var(--line)' }} />
              {t.a}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function FooterCTA() {
  const router = useRouter();

  function goToDashboard() {
    const role = getCurrentUser()?.role;
    const path = role === 'listener' ? '/listener' : role === 'therapist' ? '/therapist' : '/dashboard';
    router.push(path);
  }

  return (
    <section className="section-padding">
      <div style={{
        maxWidth: 1200, margin: '0 auto',
        padding: 'clamp(36px, 8vw, 72px) clamp(24px, 6vw, 64px)',
        background: 'linear-gradient(120deg, var(--sage) 0%, var(--sage-2) 100%)',
        borderRadius: 'clamp(20px, 4vw, 32px)', color: '#F5F1E8',
        position: 'relative', overflow: 'hidden',
      }}>
        <div aria-hidden style={{
          position: 'absolute', right: -80, top: -80, width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(255,255,255,0.25), transparent 70%)',
        }} />
        <div style={{ position: 'relative', maxWidth: 640 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.7, marginBottom: 20 }}>
            Free to start · No card required
          </div>
          <h2 className="serif" style={{ fontSize: 'clamp(32px, 6vw, 56px)', margin: 0, fontWeight: 400, lineHeight: 1.05, letterSpacing: -0.015 }}>
            You reached out.<br />That&apos;s the hardest part.
          </h2>
          <p style={{ fontSize: 18, marginTop: 20, opacity: 0.85, maxWidth: 480, lineHeight: 1.5 }}>
            The rest is easy. Start a voice session with Serenity in under 30 seconds — no signup needed.
          </p>
          <div className="cta-btns">
            <button onClick={() => router.push('/ai-call')} style={{
              padding: '14px 24px', borderRadius: 14, border: 'none',
              background: '#FBF8F0', color: 'var(--sage)',
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 10,
            }}>
              {Icon.mic(18)} Start voice session
            </button>
            <button onClick={goToDashboard} style={{
              padding: '14px 24px', borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.3)',
              background: 'transparent', color: '#F5F1E8',
              fontSize: 15, fontWeight: 500, cursor: 'pointer',
            }}>
              I already have an account
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const router = useRouter();
  return (
    <footer className="section-padding" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="g-ft" style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Logo size={36} />
            <Wordmark size={18} />
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.55, maxWidth: 300 }}>
            Mental health support, in Hindi and English. Available 24/7.
          </div>
        </div>
        {[
          { title: 'Support', links: ['Talk to Serenity', 'Peer listeners', 'Book a therapist', 'Community'] },
          { title: 'Platform', links: ['How it works', 'For therapists', 'For listeners', 'Blogs'] },
          { title: 'Company', links: ['About us', 'Terms & conditions', 'Privacy policy', 'Contact us', 'Disclaimer', 'FAQs'] },
        ].map(col => (
          <div key={col.title}>
            <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 14, fontWeight: 500 }}>{col.title}</div>
            {col.links.map(l => <FooterLink key={l} label={l} router={router} />)}
          </div>
        ))}
      </div>
      <div className="flex-bt" style={{
        maxWidth: 1200, margin: '40px auto 0',
        paddingTop: 24, borderTop: '1px solid var(--line-2)',
        fontSize: 13, color: 'var(--muted)',
      }}>
        <div>© 2026 मनmate (MannMate Technologies Pvt. Ltd.).</div>
        <div>Bengaluru, India</div>
      </div>
    </footer>
  );
}

/** Every footer link mapped to its real destination */
const FOOTER_LINK_MAP: Record<string, { type: 'route' | 'href' | 'guarded'; dest: string }> = {
  'Talk to Serenity':   { type: 'guarded', dest: '/ai-call' },
  'Peer listeners':     { type: 'guarded', dest: '/peer-call' },
  'Book a therapist':   { type: 'route',   dest: '/therapists' },
  'Community':          { type: 'route',   dest: '/community' },
  'How it works':       { type: 'route',   dest: '/' },
  'For therapists':     { type: 'route',   dest: '/auth/login' },
  'For listeners':      { type: 'route',   dest: '/listener' },
  'Blogs':              { type: 'route',   dest: '/blogs' },
  'About us':           { type: 'route',   dest: '/about' },
  'Terms & conditions': { type: 'route',   dest: '/terms' },
  'Privacy policy':     { type: 'route',   dest: '/privacy' },
  'Contact us':         { type: 'route',   dest: '/contact' },
  'Disclaimer':         { type: 'route',   dest: '/disclaimer' },
  'FAQs':               { type: 'route',   dest: '/faq' },
};

function FooterLink({ label, router }: { label: string; router: ReturnType<typeof useRouter> }) {
  const [hov, setHov] = React.useState(false);
  const entry = FOOTER_LINK_MAP[label];

  const handleClick = (e: React.MouseEvent) => {
    if (!entry || entry.type === 'href') return;
    e.preventDefault();
    if (entry.type === 'guarded' && PROTECTED_ROUTES.includes(entry.dest) && !getCurrentUser()) {
      router.push(`/auth/login?redirect=${encodeURIComponent(entry.dest)}`);
    } else {
      router.push(entry.dest);
    }
  };

  return (
    <a
      href={entry?.type === 'href' ? entry.dest : entry?.dest ?? '#'}
      onClick={handleClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'block', fontSize: 14, padding: '5px 0',
        color: hov ? 'var(--sage)' : 'var(--ink-2)',
        textDecoration: 'none', transition: 'color 0.15s', cursor: 'pointer',
      }}
    >
      {label}
    </a>
  );
}
