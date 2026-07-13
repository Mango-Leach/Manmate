'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function ListenerDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/listener'); }, [router]);
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
}
