'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TherapistDashboard } from '@/components/design/TherapistDashboard';
import { getCurrentUser, verifyAndRefreshUser, getRoleDashboard, type User } from '@/lib/api';

export default function TherapistPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const cached = getCurrentUser();
      if (!cached) { router.push('/auth/login'); return; }

      // Always verify role from DB — admin may have removed/changed it since last login
      const fresh = await verifyAndRefreshUser();
      const u = fresh || cached;

      const redirect = getRoleDashboard(u.role);
      if (redirect !== '/therapist') {
        router.replace(redirect);
        return;
      }

      setUser(u);
      setLoading(false);
    };
    init();
  }, [router]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  return <TherapistDashboard user={user} />;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--sage-soft)', borderTopColor: 'var(--sage)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
