'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark, Button } from '@/components/design/primitives';
import { registerUser, getGoogleAuthUrl, saveUser, getRoleDashboard } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [listenerName, setListenerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await registerUser(name, email, password, phone);
      if (res.success && res.data) {
        saveUser(res.data.user, res.data.token);
        // Save display name to profile extras so peer call can use it
        const displayName = listenerName.trim() || name.split(' ')[0];
        const extrasKey = `profile_extras_${res.data.user.email}`;
        const existing = JSON.parse(localStorage.getItem(extrasKey) || '{}');
        localStorage.setItem(extrasKey, JSON.stringify({ ...existing, listenerName: displayName }));
        router.push(getRoleDashboard(res.data.user.role));
      } else {
        setError(res.message || 'Registration failed');
      }
    } catch { setError('Network error. Please try again.'); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <Logo size={52} />
            <Wordmark size={24} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>Create your account. It takes under a minute.</p>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 24, padding: 32 }}>
          <a href={getGoogleAuthUrl()} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '12px 20px', borderRadius: 12, border: '1px solid var(--line)',
            background: 'var(--bg)', color: 'var(--ink)', textDecoration: 'none',
            fontSize: 14, fontWeight: 500, marginBottom: 24,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign up with Google
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)', fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" required style={inputStyle} />
            <div>
              <input
                type="text" value={listenerName}
                onChange={e => setListenerName(e.target.value)}
                placeholder="Display name shown to listeners (e.g. a nickname)"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, paddingLeft: 2 }}>
                This is what your listener sees when you connect — not your real name. Leave blank to use your first name.
              </div>
            </div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required style={inputStyle} />
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone number (for WhatsApp reminders)" style={inputStyle} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" required minLength={8} style={inputStyle} />
            <Button tone="primary" size="lg" full style={{ marginTop: 8 }}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 16, textAlign: 'center', lineHeight: 1.5 }}>
            By creating an account you agree to our{' '}
            <a href="/terms" style={{ color: 'var(--sage)', textDecoration: 'underline' }}>Terms &amp; Conditions</a>{' '}
            and privacy policy. Your data is never shared without consent.
          </p>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 24 }}>
          Already have an account?{' '}
          <button onClick={() => router.push('/auth/login')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 16px',
  borderRadius: 12, border: '1px solid var(--line)',
  background: 'var(--bg)', color: 'var(--ink)',
  fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
