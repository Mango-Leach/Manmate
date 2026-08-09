'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark } from '@/components/design/primitives';
import { getCurrentUser, getRoleDashboard } from '@/lib/api';
import Footer from '@/components/layout/Footer';

export default function DisclaimerPage() {
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
        <div style={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', opacity: 0.7, fontWeight: 600, marginBottom: 16 }}>Legal & Transparency</div>
        <h1 className="serif" style={{ fontSize: 52, fontWeight: 400, margin: '0 0 16px', letterSpacing: -0.02, lineHeight: 1.1 }}>
          Disclaimer
        </h1>
        <p style={{ fontSize: 16, opacity: 0.85, maxWidth: 580, margin: '0 auto', lineHeight: 1.6 }}>
          Important information regarding medical/clinical boundaries, emergency care, external links, and third-party advertising on मनmate.
        </p>
      </div>

      {/* Main Content */}
      <main style={{ flex: 1, maxWidth: 860, margin: '0 auto', padding: '64px 32px 90px' }}>

        {/* Emergency Notice */}
        <div style={{
          background: 'rgba(217, 83, 79, 0.08)',
          border: '1px solid rgba(217, 83, 79, 0.25)',
          borderLeft: '4px solid #D9534F',
          borderRadius: '0 16px 16px 0',
          padding: '20px 24px',
          marginBottom: 40,
        }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: '#C9302C', margin: '0 0 8px' }}>
            🚨 Emergency Crisis Notice
          </h2>
          <p style={{ fontSize: 14.5, color: 'var(--ink, #2C3531)', lineHeight: 1.65, margin: 0 }}>
            मनmate (MannMate Technologies Pvt. Ltd.) is <strong>NOT</strong> an emergency medical or psychiatric crisis service. If you are experiencing thoughts of self-harm, suicide, or an acute mental health emergency, please immediately call your local emergency services (112 in India) or reach Tele-MANAS at <strong>14416</strong> / <strong>1800 891 4416</strong> (24x7 toll-free helpline).
          </p>
        </div>

        {/* 1. Medical & Clinical Disclaimer */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="serif" style={sectionTitleStyle}>1. Medical & Educational Disclaimer</h2>
          <p style={paragraphStyle}>
            All articles, self-care guides, mood tracking tools, and AI assistant responses provided on मनmate are intended for general educational and informational purposes only. They do not constitute formal medical diagnosis, clinical treatment, or psychiatric advice.
          </p>
          <p style={paragraphStyle}>
            Peer listeners on our platform provide non-clinical emotional listening support and are not licensed healthcare providers. Consultations with licensed psychologists or psychiatrists on मनmate are conducted independently by registered professionals.
          </p>
        </section>

        {/* 2. Advertising & Google AdSense Disclaimer */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="serif" style={sectionTitleStyle}>2. Advertising & Google AdSense Disclosure</h2>
          <p style={paragraphStyle}>
            To keep our educational content free and accessible, मनmate participates in Google AdSense and other advertising networks. Third-party advertisements may appear on public blog pages and content sections of our website.
          </p>
          <p style={paragraphStyle}>
            Google AdSense uses cookies to serve ads based on users' visits to this and other websites. The presence of an advertisement on मनmate does not constitute an endorsement, guarantee, or recommendation of the product or service advertised. We maintain strict editorial independence; advertisers have zero influence over our educational or clinical content.
          </p>
        </section>

        {/* 3. Third-Party Links Disclaimer */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="serif" style={sectionTitleStyle}>3. External Links Disclaimer</h2>
          <p style={paragraphStyle}>
            Our platform may contain links to external third-party websites or resources. MannMate Technologies Private Limited has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party websites.
          </p>
        </section>

        {/* 4. Limitation of Liability */}
        <section style={{ marginBottom: 40 }}>
          <h2 className="serif" style={sectionTitleStyle}>4. Limitation of Liability</h2>
          <p style={paragraphStyle}>
            Your use of मनmate and reliance on any information on the platform is solely at your own risk. MannMate Technologies Private Limited, its directors, officers, and employees shall not be liable for any direct, indirect, or consequential damages arising from site access or content use.
          </p>
        </section>

      </main>

      <Footer />
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 400,
  color: 'var(--ink, #2C3531)',
  margin: '0 0 12px',
};

const paragraphStyle: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--ink-2, #4A5650)',
  lineHeight: 1.75,
  marginBottom: 14,
};

const navBtnStyle: React.CSSProperties = {
  padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line, #E5DFC9)',
  background: 'var(--card, #FFFFFF)', color: 'var(--ink, #2C3531)', fontSize: 13, fontWeight: 500,
  cursor: 'pointer',
};
