'use client';
import React, { useState, useEffect } from 'react';
import { GlobalHeader } from '@/components/design/primitives';
import { getCurrentUser } from '@/lib/api';

export function BlogHeader() {
  const [user, setUser] = useState<ReturnType<typeof getCurrentUser>>(null);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  return <GlobalHeader user={user} />;
}
