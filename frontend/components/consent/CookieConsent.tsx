'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Unregister any stale Service Workers in development to prevent Webpack chunk mismatch
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        const hadController = Boolean(navigator.serviceWorker.controller);
        const unregisterWorkers = Promise.all(registrations.map((registration) => registration.unregister()));

        // An unregistered worker can still control this tab until navigation.
        // Reload once so the browser requests the current dev chunks directly.
        if (hadController && registrations.length > 0) {
          const reloadKey = 'mannmate-dev-service-worker-reloaded';
          try {
            if (!sessionStorage.getItem(reloadKey)) {
              sessionStorage.setItem(reloadKey, '1');
              unregisterWorkers
                .then(() => ('caches' in window ? caches.keys() : []))
                .then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
                .finally(() => window.location.reload());
            } else {
              sessionStorage.removeItem(reloadKey);
            }
          } catch {
            // Browser storage can be disabled; unregistering still prevents future control.
          }
        }
      });
    }

    const consent = localStorage.getItem('mannmate_cookie_consent');
    if (!consent) {
      // Show consent banner after a short delay for better user experience
      const timer = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    localStorage.setItem('mannmate_cookie_consent', 'accepted_all');
    setVisible(false);
  };

  const handleAcceptEssential = () => {
    localStorage.setItem('mannmate_cookie_consent', 'essential_only');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie Consent Banner"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        right: 20,
        maxWidth: 680,
        margin: '0 auto',
        zIndex: 9999,
        background: 'rgba(251, 248, 240, 0.96)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--line, #E5DFC9)',
        boxShadow: '0 20px 40px -10px rgba(58, 82, 70, 0.15), 0 0 0 1px rgba(58, 82, 70, 0.05)',
        borderRadius: 20,
        padding: '20px 24px',
        color: 'var(--ink, #2C3531)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }} role="img" aria-label="cookie">🍪</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--ink, #2C3531)' }}>
              Cookie & Privacy Preferences
            </h3>
          </div>
          <button
            onClick={handleAcceptEssential}
            aria-label="Close cookie banner"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted, #7A8680)',
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink-2, #4A5650)', lineHeight: 1.6 }}>
          We use essential cookies to maintain secure sessions and operational stability. Third-party vendors including Google use cookies to serve personalized advertisements on our blog pages based on prior site visits. You can manage or opt out via{' '}
          <a
            href="https://adssettings.google.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--sage, #3A5246)', textDecoration: 'underline', fontWeight: 500 }}
          >
            Google Ads Settings
          </a>{' '}
          or review our full{' '}
          <Link
            href="/privacy#cookies"
            style={{ color: 'var(--sage, #3A5246)', textDecoration: 'underline', fontWeight: 500 }}
          >
            Privacy Policy
          </Link>.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
          <button
            onClick={handleAcceptEssential}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: '1px solid var(--line, #E5DFC9)',
              background: 'var(--card, #FFFFFF)',
              color: 'var(--ink, #2C3531)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            Essential Only
          </button>
          <button
            onClick={handleAcceptAll}
            style={{
              padding: '8px 20px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--sage, #3A5246)',
              color: '#FBF8F0',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: '0 2px 8px rgba(58, 82, 70, 0.2)',
            }}
          >
            Accept All Cookies
          </button>
        </div>
      </div>
    </div>
  );
}

export default CookieConsent;
