'use client';
import React from 'react';
import { getCurrentUser } from '@/lib/api';
import { addFavorite, removeFavorite, getFavorites, favoriteId, type FavRole } from '@/lib/favorites';

/**
 * Toggle button that adds/removes the person you're connected with to your
 * favorites. Drops into a session top bar (`variant="icon"`) or a post-session
 * screen (`variant="full"`).
 */
export function FavoriteHeart({
  name,
  role,
  email,
  mode,
  variant = 'icon',
}: {
  name: string;
  role: FavRole;
  email?: string;
  mode: 'chat' | 'call';
  variant?: 'icon' | 'full';
}) {
  const [isFav, setIsFav] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const id = favoriteId(role, name, email);

  // Reflect the current saved state for this person.
  React.useEffect(() => {
    const u = getCurrentUser();
    if (!u?.email || !name) return;
    let alive = true;
    getFavorites(u.email)
      .then(list => { if (alive) setIsFav(list.some(f => f.id === id)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [id, name]);

  async function toggle() {
    const u = getCurrentUser();
    if (!u?.email || !name || busy) return;
    setBusy(true);
    const next = !isFav;
    setIsFav(next); // optimistic
    try {
      if (next) {
        await addFavorite(u.email, { id, name, role, email, mode, addedAt: Date.now() });
      } else {
        await removeFavorite(u.email, id);
      }
    } catch {
      setIsFav(!next); // revert on failure
    } finally {
      setBusy(false);
    }
  }

  const heart = (filled: boolean) => (
    <svg width={variant === 'full' ? 16 : 17} height={variant === 'full' ? 16 : 17} viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  );

  if (variant === 'full') {
    return (
      <button onClick={toggle} disabled={busy} title={isFav ? 'Remove from favorites' : 'Add to favorites'} style={{
        padding: '10px 20px', borderRadius: 12, cursor: busy ? 'default' : 'pointer',
        border: `1px solid ${isFav ? 'var(--lavender)' : 'var(--line)'}`,
        background: isFav ? 'var(--lavender-soft)' : 'var(--card)',
        color: isFav ? 'var(--lavender)' : 'var(--ink-2)',
        fontSize: 14, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all 0.2s',
      }}>
        {heart(isFav)}
        {isFav ? 'Saved to favorites' : `Add ${name} to favorites`}
      </button>
    );
  }

  return (
    <button onClick={toggle} disabled={busy} title={isFav ? 'Remove from favorites' : 'Add to favorites'} style={{
      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
      border: `1px solid ${isFav ? 'var(--lavender)' : 'var(--line)'}`,
      background: isFav ? 'var(--lavender-soft)' : 'var(--card)',
      color: isFav ? 'var(--lavender)' : 'var(--muted)',
      cursor: busy ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s',
    }}>
      {heart(isFav)}
    </button>
  );
}
