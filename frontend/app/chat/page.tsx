'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { ChatSession } from '@/components/design/ChatSession';
import { getCurrentUser, verifyAndRefreshUser } from '@/lib/api';

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--lavender-soft)', borderTopColor: 'var(--lavender)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      const cached = getCurrentUser();
      if (!cached) { router.replace('/auth/login'); return; }

      const fresh = await verifyAndRefreshUser();
      if (!fresh && !cached) { router.replace('/auth/login'); return; }

      setReady(true);
    };
    init();
  }, [router]);

  if (!ready) return <Spinner />;

  return <ChatSession />;
}

export default function ChatPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ChatPageInner />
    </Suspense>
  );
}
