'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo, Wordmark, Button } from '@/components/design/primitives';
import { sendOTP, verifyOTP, sendMobileOTP, verifyMobileOTP, getGoogleAuthUrl, saveUser, getRoleDashboard, completeProfile } from '@/lib/api';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [redirectAfterLogin, setRedirectAfterLogin] = useState('');

  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [suspended, setSuspended] = useState(false);

  // A-1: after a mobile-OTP login for a brand-new account there is no name
  // source (email/Google logins auto-populate it). Hold the session here and
  // show a popup collecting Name + Display Name before entering the app.
  const [pendingProfile, setPendingProfile] = useState<{ token: string; user: any } | null>(null);

  useEffect(() => {
    if (searchParams.get('suspended') === 'true') setSuspended(true);
  }, [searchParams]);

  // Resend cooldown timer
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const dest = searchParams.get('redirect');
    if (dest) setRedirectAfterLogin(dest);
  }, [searchParams]);

  useEffect(() => {
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current); };
  }, []);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const isPhone = (val: string) => /^\d{10}$/.test(val.trim());
  const isEmail = (val: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  const inputType = isPhone(identifier) ? 'mobile' : isEmail(identifier) ? 'email' : null;

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = identifier.trim();

    if (!val) { setError('Enter your email or mobile number'); return; }
    if (!isPhone(val) && !isEmail(val)) {
      setError('Enter a valid email address or 10-digit mobile number');
      return;
    }

    // Show OTP field immediately
    setOtpSent(true);
    setError('');

    try {
      const res = isPhone(val)
        ? await sendMobileOTP(val)
        : await sendOTP(val);

      if (res.success) {
        if (isPhone(val)) startCooldown(60);
      } else {
        setOtpSent(false);
        // If backend sends retryAfter, start cooldown so user knows when to retry
        const retryAfter = (res as any).retryAfter;
        if (retryAfter) startCooldown(retryAfter);
        setError(res.message || 'Could not send OTP. Try again.');
      }
    } catch {
      setOtpSent(false);
      setError('Network error. Please try again.');
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const val = identifier.trim();
    setError('');
    try {
      const res = isPhone(val)
        ? await sendMobileOTP(val)
        : await sendOTP(val);

      if (res.success) {
        if (isPhone(val)) startCooldown(60);
      } else {
        const retryAfter = (res as any).retryAfter;
        if (retryAfter) startCooldown(retryAfter);
        setError(res.message || 'Could not send OTP. Try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = identifier.trim();
    setVerifying(true); setError('');
    try {
      const res = isPhone(val)
        ? await verifyMobileOTP(val, otp)
        : await verifyOTP(val, otp);

      if (res.success && res.data) {
        const needsProfile = isPhone(val) && (res.data.needsProfile || !res.data.user?.name || res.data.user?.name === 'Member');
        if (needsProfile) {
          // Don't enter the app yet — collect the user's name first (A-1).
          setPendingProfile({ token: res.data.token, user: res.data.user });
        } else {
          saveUser(res.data.user, res.data.token);
          router.push(redirectAfterLogin || getRoleDashboard(res.data.user.role));
        }
      } else if ((res as any).suspended) {
        setSuspended(true);
      } else {
        setError(res.message || 'Invalid OTP. Please try again.');
      }
    } catch { setError('Network error. Please try again.'); }
    setVerifying(false);
  };

  if (suspended) return <SuspendedScreen />;

  if (pendingProfile) {
    return (
      <CompleteProfileModal
        token={pendingProfile.token}
        onDone={(user, token) => {
          saveUser(user, token);
          router.push(redirectAfterLogin || getRoleDashboard(user.role));
        }}
      />
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
            <Logo size={52} />
            <Wordmark size={24} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>Welcome back. Sign in to continue.</p>
        </div>

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 24, padding: 32 }}>

          <a href={getGoogleAuthUrl()} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            padding: '12px 20px', borderRadius: 12, border: '1px solid var(--line)',
            background: 'var(--bg)', color: 'var(--ink)', textDecoration: 'none',
            fontSize: 14, fontWeight: 500, marginBottom: 24, transition: 'background 0.2s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
            <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 500 }}>or sign in with OTP</span>
            <div style={{ flex: 1, height: 1, background: 'var(--line)' }} />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)', fontSize: 14, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={otpSent ? handleVerifyOTP : handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', paddingLeft: 4 }}>
                Email or mobile number
              </label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Enter email or 10-digit mobile number"
                required
                disabled={otpSent}
                style={{ ...inputStyle, opacity: otpSent ? 0.6 : 1 }}
              />
            </div>

            {otpSent && (
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                required
                maxLength={6}
                style={inputStyle}
                autoFocus
              />
            )}

            <Button tone="primary" size="lg" full style={{ marginTop: 8 }}>
              {verifying ? '…' : otpSent ? 'Verify OTP' : 'Send OTP'}
            </Button>

            {otpSent && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(''); setError(''); setCooldown(0); }}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
                >
                  Use a different {inputType === 'mobile' ? 'number' : 'email'}
                </button>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  style={{
                    background: 'none', border: 'none', fontSize: 13, cursor: cooldown > 0 ? 'default' : 'pointer',
                    color: cooldown > 0 ? 'var(--muted)' : 'var(--sage)',
                    textDecoration: cooldown > 0 ? 'none' : 'underline',
                  }}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
                </button>
              </div>
            )}
          </form>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, marginTop: 24 }}>
          New here?{' '}
          <button onClick={() => router.push('/auth/register')} style={{ background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontWeight: 500, fontSize: 14 }}>
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
}

function CompleteProfileModal({ token, onDone }: { token: string; onDone: (user: any, token: string) => void }) {
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const cleanDisplay = displayName.trim();
    if (cleanName.length < 2) { setError('Please enter your name (at least 2 characters).'); return; }
    if (cleanDisplay && cleanDisplay.length < 2) { setError('Display name must be at least 2 characters.'); return; }
    setSaving(true); setError('');
    try {
      const res = await completeProfile(cleanName, cleanDisplay || cleanName, token);
      if (res.success && res.data) {
        onDone(res.data.user, res.data.token);
      } else {
        setError(res.message || (res as any).error || 'Could not save your name. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.4)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 24, padding: 32 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
            <Logo size={44} />
            <Wordmark size={20} />
          </div>
          <h2 className="serif" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 8px', color: 'var(--ink)' }}>
            Welcome! What should we call you?
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>
            You signed in with your mobile number, so we don&apos;t know your name yet.
          </p>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)', fontSize: 14, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', paddingLeft: 4 }}>Full name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Priya Sharma"
              required
              maxLength={100}
              autoFocus
              style={inputStyle}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--muted)', paddingLeft: 4 }}>
              Display name <span style={{ fontWeight: 400 }}>(shown to others — optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="e.g. Priya"
              maxLength={50}
              style={inputStyle}
            />
          </div>
          <Button tone="primary" size="lg" full style={{ marginTop: 8 }}>
            {saving ? 'Saving…' : 'Continue'}
          </Button>
        </form>
      </div>
    </div>
  );
}

function SuspendedScreen() {
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'business.mannmate@gmail.com';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460, textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', margin: '0 auto 28px',
          background: 'rgba(124,29,29,0.08)', border: '2px solid rgba(124,29,29,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#7C1D1D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
          </svg>
        </div>

        <div style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: '#7C1D1D', fontWeight: 600, marginBottom: 12 }}>
          Account Suspended
        </div>

        <h1 className="serif" style={{ fontSize: 30, fontWeight: 400, margin: '0 0 16px', color: 'var(--ink)', letterSpacing: -0.3 }}>
          Your account has been suspended
        </h1>

        <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--muted)', margin: '0 0 32px', maxWidth: 380, marginLeft: 'auto', marginRight: 'auto' }}>
          Access to your account has been restricted due to a violation of our community standards. If you believe this was a mistake, please reach out to our support team.
        </p>

        {/* Contact us card */}
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 18, padding: '24px 28px', marginBottom: 24,
        }}>
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
            To appeal your suspension, contact us at:
          </p>
          <a
            href={`mailto:${supportEmail}?subject=Account Suspension Appeal&body=Hello, I would like to appeal the suspension of my account.`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: 'var(--sage)', color: '#FBF8F0',
              textDecoration: 'none', fontSize: 14, fontWeight: 600,
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => ((e.target as HTMLElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.target as HTMLElement).style.opacity = '1')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
            </svg>
            Contact Support
          </a>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '12px 0 0' }}>
            {supportEmail}
          </p>
        </div>

        <a href="/auth/login" style={{ fontSize: 13, color: 'var(--muted)', textDecoration: 'underline' }}>
          Try a different account
        </a>
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
