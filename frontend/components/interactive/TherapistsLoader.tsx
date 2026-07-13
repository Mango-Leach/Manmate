'use client';
import { useState, useEffect } from 'react';
import { Therapists } from '@/components/design/Therapists';
import { getCurrentUser, type User } from '@/lib/api';

export function TherapistsLoader() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { setUser(getCurrentUser()); }, []);
  return <Therapists user={user} />;
}
