'use client';
import { useRouter } from 'next/navigation';
import { Logo, Button } from '@/components/design/primitives';

export default function NotFound() {
  const router = useRouter();
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
      <div>
        <Logo size={48} />
        <h1 className="serif" style={{ fontSize: 96, margin: '24px 0 8px', color: 'var(--sage)', fontWeight: 400 }}>404</h1>
        <p style={{ color: 'var(--ink-2)', fontSize: 18, marginBottom: 32 }}>This page doesn&apos;t exist.</p>
        <Button tone="primary" size="lg" onClick={() => router.push('/')}>Go home</Button>
      </div>
    </div>
  );
}
