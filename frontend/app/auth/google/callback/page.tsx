'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Logo, Wordmark } from '@/components/design/primitives';
import { saveUser, getRoleDashboard, verifyAndRefreshUser, type User } from '@/lib/api';

function GoogleCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication…');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (error || !token) {
          setStatus('error');
          setMessage(error ? 'Authentication failed. Please try again.' : 'No token received.');
          setTimeout(() => router.push('/auth/login'), 2500);
          return;
        }

        localStorage.setItem('authToken', token);

        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const user: User = {
            id: payload.userId || payload.id || payload._id,
            name: payload.name || 'User',
            email: payload.email || '',
            phone: payload.phone || '',
            role: payload.role || 'user',
            provider: 'google',
            picture: payload.picture,
          };
          saveUser(user, token);
          // Verify role from DB in case JWT role is stale
          const freshUser = await verifyAndRefreshUser();
          const finalUser = freshUser || user;
          setStatus('success');
          setMessage(`Welcome back, ${finalUser.name.split(' ')[0]}!`);
          const redirectPath = getRoleDashboard(finalUser.role);
          setTimeout(() => router.push(redirectPath), 1500);
        } catch {
          setStatus('error');
          setMessage('Failed to process user data.');
          setTimeout(() => router.push('/auth/login'), 2500);
        }
      } catch {
        setStatus('error');
        setMessage('An unexpected error occurred.');
        setTimeout(() => router.push('/auth/login'), 2500);
      }
    };
    handleCallback();
  }, [searchParams, router]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 32 }}>
          <Logo size={52} />
          <Wordmark size={24} />
        </div>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', margin: '0 auto 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: status === 'success' ? 'var(--sage-soft)' : status === 'error' ? 'rgba(178,107,92,0.15)' : 'var(--bg-2)',
        }}>
          {status === 'processing' && (
            <>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '3px solid var(--sage-soft)', borderTopColor: 'var(--sage)', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </>
          )}
          {status === 'success' && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
          {status === 'error' && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--alert)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>}
        </div>
        <p style={{ fontSize: 16, color: 'var(--ink-2)' }}>{message}</p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <GoogleCallbackInner />
    </Suspense>
  );
}
