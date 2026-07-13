'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDashboard } from '@/components/design/AdminDashboard';
import { getCurrentUser, verifyAndRefreshUser, type User } from '@/lib/api';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getCurrentUser();
    if (!cached) { router.push('/auth/login'); return; }
    verifyAndRefreshUser().then(u => {
      if (!u) { router.push('/auth/login'); return; }
      if (u.role !== 'admin') { router.push('/dashboard'); return; }
      setUser(u);
      setLoading(false);
    });
  }, [router]);

  if (loading) return <LoadingScreen />;
  if (!user) return null;
  return <AdminDashboard user={user} />;
}

function LoadingScreen() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--sage-soft)', borderTopColor: 'var(--sage)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
