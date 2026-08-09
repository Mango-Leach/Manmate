'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Logo, Wordmark } from '@/components/design/primitives';
import { getCurrentUser, getRoleDashboard } from '@/lib/api';
import Footer from '@/components/layout/Footer';

export default function AboutPage() {
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const dashboardPath = user ? getRoleDashboard(user.role) : '/';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg, #FBF8F0)', display: 'flex', flexDirection: 'column' }}>

      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,241,232,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line, #E5DFC9)', padding: '0 clamp(16px, 4vw, 48px)', height: 60,
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
                <button onClick={() => router.push('/auth/register')} style={{ ...navBtnStyle, background: 'var(--sage, #3A5246)', color: '#FBF8F0', border: 'none' }}>Get started</button>
              </>
          }
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #3A5246 0%, var(--sage, #3A5246) 60%, #4A6356 100%)',
        padding: '72px 48px 56px', textAlign: 'center', color: '#F5F1E8',
      }}>
        <div style={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.7, fontWeight: 600, marginBottom: 16 }}>About Us</div>
        <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, margin: '0 0 16px', letterSpacing: -0.02, lineHeight: 1.1 }}>
          Democratising Mental Healthcare in India
        </h1>
        <p style={{ fontSize: 16.5, opacity: 0.85, maxWidth: 640, margin: '0 auto', lineHeight: 1.6 }}>
          मनmate is built on a simple premise: everyone deserves compassionate, immediate, and culturally sensitive emotional support — in their own language.
        </p>
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: 860, margin: '0 auto', padding: '64px 32px 90px' }}>

        <section style={{ marginBottom: 48 }}>
          <h2 className="serif" style={{ fontSize: 32, fontWeight: 400, color: 'var(--ink, #2C3531)', margin: '0 0 16px' }}>
            Our Mission
          </h2>
          <p style={paragraphStyle}>
            Mental health care in India faces immense barriers: social stigma, exorbitant therapy costs, language disconnect, and an alarming shortage of clinical practitioners. <strong>MannMate Technologies Private Limited</strong> was founded to bridge this void by combining peer support, licensed therapy, and AI-assisted wellness tools into one accessible digital ecosystem.
          </p>
          <p style={paragraphStyle}>
            Whether someone needs a quick, non-judgmental peer listener late at night or structured psychotherapy with RCI-verified professionals in Hindi or English, मनmate provides a confidential, safe harbor.
          </p>
        </section>

        {/* Core Pillars */}
        <section style={{ marginBottom: 56 }}>
          <h2 className="serif" style={{ fontSize: 28, fontWeight: 400, color: 'var(--ink, #2C3531)', margin: '0 0 24px' }}>
            What Sets Us Apart
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
            <div style={cardStyle}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>💬</div>
              <h3 style={cardTitleStyle}>Peer Listening</h3>
              <p style={cardBodyStyle}>Empathic, trained listeners available for real-time 1-on-1 conversations without appointment wait times.</p>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>🩺</div>
              <h3 style={cardTitleStyle}>Licensed Therapists</h3>
              <p style={cardBodyStyle}>RCI & NIMHANS verified psychologists providing clinical consultations and ongoing therapy.</p>
            </div>
            <div style={cardStyle}>
              <div style={{ fontSize: 24, marginBottom: 10 }}>🤖</div>
              <h3 style={cardTitleStyle}>AI Wellness Assistant</h3>
              <p style={cardBodyStyle}>24/7 multilingual guidance for anxiety reduction, journal prompts, and immediate grounding exercises.</p>
            </div>
          </div>
        </section>

        {/* Editorial Standards & Authorship */}
        <section style={{
          background: 'var(--card, #FFFFFF)',
          border: '1px solid var(--line, #E5DFC9)',
          borderRadius: 20,
          padding: '32px 36px',
          marginBottom: 48,
        }}>
          <h2 className="serif" style={{ fontSize: 26, fontWeight: 400, color: 'var(--ink, #2C3531)', margin: '0 0 14px' }}>
            Editorial & Content Standards
          </h2>
          <p style={paragraphStyle}>
            Our educational articles and self-care resources are authored by qualified mental health practitioners and peer specialists. Every piece of published content undergoes rigorous editorial review to ensure clinical accuracy, cultural sensitivity, and strict adherence to evidence-based practices.
          </p>
          <p style={{ ...paragraphStyle, margin: 0 }}>
            We adhere to strict transparency principles. Sponsored content or third-party advertisements served via Google AdSense are clearly distinguished from our clinical tools and educational articles.
          </p>
        </section>

        {/* Corporate Details */}
        <section style={{ marginBottom: 32 }}>
          <h2 className="serif" style={{ fontSize: 24, fontWeight: 400, color: 'var(--ink, #2C3531)', margin: '0 0 12px' }}>
            Company & Leadership
          </h2>
          <div style={{ fontSize: 14.5, color: 'var(--ink-2, #4A5650)', lineHeight: 1.7 }}>
            <strong>Legal Entity:</strong> MannMate Technologies Private Limited<br />
            <strong>Registered Location:</strong> Bengaluru, Karnataka — 560001, India<br />
            <strong>Contact Email:</strong> <a href="mailto:business.mannmate@gmail.com" style={linkStyle}>business.mannmate@gmail.com</a>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

const paragraphStyle: React.CSSProperties = {
  fontSize: 15.5,
  color: 'var(--ink-2, #4A5650)',
  lineHeight: 1.75,
  marginBottom: 16,
};

const cardStyle: React.CSSProperties = {
  background: 'var(--card, #FFFFFF)',
  border: '1px solid var(--line, #E5DFC9)',
  borderRadius: 16,
  padding: '24px',
};

const cardTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 600,
  color: 'var(--ink, #2C3531)',
  margin: '0 0 8px',
};

const cardBodyStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ink-2, #4A5650)',
  lineHeight: 1.6,
  margin: 0,
};

const navBtnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line, #E5DFC9)',
  background: 'var(--card, #FFFFFF)', color: 'var(--ink, #2C3531)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};

const linkStyle: React.CSSProperties = {
  color: 'var(--sage, #3A5246)', textDecoration: 'underline',
};
