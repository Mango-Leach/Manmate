'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

const PeerCall = dynamic(
  () => import('@/components/design/PeerCall').then(m => ({ default: m.PeerCall })),
  { ssr: false, loading: () => <LoadingShell /> }
);

function LoadingShell() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--lavender-soft)', borderTopColor: 'var(--lavender)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function PeerCallPageInner() {
  const params = useSearchParams();
  const mode = params.get('mode') === 'peer' ? 'peer' : 'listener';
  const directTo = params.get('to') || undefined;
  return <PeerCall mode={mode} directTo={directTo} />;
}

export default function PeerCallPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <PeerCallPageInner />
    </Suspense>
  );
}
