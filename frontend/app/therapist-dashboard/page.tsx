'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function TherapistDashboardRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/therapist'); }, [router]);
  return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
}
