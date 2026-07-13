'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dashboard } from '@/components/design/Dashboard';
import { getCurrentUser, type User } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getCurrentUser();
    if (!u) { router.push('/auth/login'); return; }
    if (u.role === 'listener') { router.push('/listener'); return; }
    if (u.role === 'therapist') { router.push('/therapist'); return; }
    // admins can reach /dashboard intentionally via the "Client View" button
    setUser(u);
    setLoading(false);
  }, [router]);

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--sage-soft)', borderTopColor: 'var(--sage)', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!user) return null;
  return <Dashboard user={user} />;
}
