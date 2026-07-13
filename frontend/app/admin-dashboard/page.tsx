'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function AdminDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/admin'); }, [router]);
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
}
