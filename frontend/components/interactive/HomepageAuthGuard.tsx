'use client';
import { useState, useEffect } from 'react';
import { Homepage } from '@/components/design/Homepage';
import { getCurrentUser, type User } from '@/lib/api';

export function HomepageAuthGuard() {
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Always show the landing page — logged-in or not.
    // The auto-redirect on first login is handled by the login page itself.
    setUser(getCurrentUser());
    setChecked(true);
  }, []);

  if (!checked) return null;
  return <Homepage user={user} />;
}
