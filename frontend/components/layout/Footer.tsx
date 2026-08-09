'use client';

import React from 'react';
import Link from 'next/link';
import { Logo, Wordmark } from '@/components/design/primitives';

export function Footer() {
  return (
    <footer
      style={{
        background: 'var(--card, #FFFFFF)',
        borderTop: '1px solid var(--line, #E5DFC9)',
        padding: '48px clamp(16px, 5vw, 64px) 36px',
        color: 'var(--ink-2, #4A5650)',
        fontSize: 14,
        marginTop: 'auto',
      }}
    >
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 36, marginBottom: 40 }}>
          
          {/* Brand Info */}
          <div style={{ maxWidth: 360 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <Logo size={36} />
              <Wordmark size={18} />
            </div>
            <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted, #7A8680)', lineHeight: 1.6 }}>
              Online mental health support &amp; therapy in Hindi and English. Private, accessible, and available 24/7.
            </p>
          </div>

          {/* Essential Trust Links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48 }}>
            <div>
              <div style={footerHeadingStyle}>Platform</div>
              <ul style={listStyle}>
                <li><Link href="/" style={linkStyle}>Home</Link></li>
                <li><Link href="/blogs" style={linkStyle}>Mental Health Blog</Link></li>
                <li><Link href="/therapists" style={linkStyle}>Find Therapists</Link></li>
                <li><Link href="/listener" style={linkStyle}>Become a Listener</Link></li>
              </ul>
            </div>

            <div>
              <div style={footerHeadingStyle}>Trust &amp; Legal</div>
              <ul style={listStyle}>
                <li><Link href="/privacy" style={linkStyle}>Privacy Policy</Link></li>
                <li><Link href="/terms" style={linkStyle}>Terms of Service</Link></li>
                <li><Link href="/about" style={linkStyle}>About Us</Link></li>
                <li><Link href="/contact" style={linkStyle}>Contact Us</Link></li>
                <li><Link href="/disclaimer" style={linkStyle}>Disclaimer</Link></li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div style={{
          borderTop: '1px solid var(--line, #E5DFC9)',
          paddingTop: 24,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          fontSize: 12.5,
          color: 'var(--muted, #7A8680)',
        }}>
          <div>
            © {new Date().getFullYear()} MannMate Technologies Private Limited. All rights reserved.
          </div>
          <div>
            Bengaluru, Karnataka — 560001, India
          </div>
        </div>
      </div>
    </footer>
  );
}

const footerHeadingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: 'var(--ink, #2C3531)',
  marginBottom: 12,
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const linkStyle: React.CSSProperties = {
  color: 'var(--ink-2, #4A5650)',
  textDecoration: 'none',
  fontSize: 13.5,
  transition: 'color 0.15s ease',
};

export default Footer;
