'use client';
import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/api';

function CallInterfaceInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.push('/auth/login'); return; }
    const room = searchParams.get('room');
    const role = searchParams.get('role');
    const peer = searchParams.get('peer');
    const autoStart = searchParams.get('autoStart');
    // Forward to peer-call with params
    const params = new URLSearchParams();
    if (room) params.set('room', room);
    if (role) params.set('role', role);
    if (peer) params.set('peer', peer);
    if (autoStart) params.set('autoStart', autoStart);
    const qs = params.toString();
    router.replace(`/peer-call${qs ? `?${qs}` : ''}`);
  }, [router, searchParams]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--lavender-soft)', borderTopColor: 'var(--lavender)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CallInterfacePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--bg)' }} />}>
      <CallInterfaceInner />
    </Suspense>
  );
}
