// Favorites data layer — lets a client bookmark listeners/peers they connected
// with and re-launch a session with them later. Persisted on the user document
// via the backend favorites endpoints (GET/PUT /api/users/:email/favorites).
import { getToken } from './api';

function getApiUrl(): string {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (!url.startsWith('http')) {
    if (!url.includes('.')) url = `https://${url}.onrender.com`;
    else url = url.includes('localhost') || url.includes('127.0.0.1') ? `http://${url}` : `https://${url}`;
  }
  return url;
}

export type FavRole = 'listener' | 'peer';

export interface Favorite {
  /** Stable de-dupe key: the person's email when known, else `${role}:${name}`. */
  id: string;
  name: string;
  role: FavRole;
  /** Present for listeners (and peers when the server shares it); absent for anonymous peers. */
  email?: string;
  /** How the favorite was connected — drives which queue 'Connect again' re-enters. */
  mode: 'chat' | 'call';
  addedAt: number;
}

/** Build the stable de-dupe id for a person. */
export function favoriteId(role: FavRole, name: string, email?: string): string {
  return email ? email.toLowerCase() : `${role}:${name.trim().toLowerCase()}`;
}

export async function getFavorites(email: string): Promise<Favorite[]> {
  if (!email) return [];
  try {
    const res = await fetch(`${getApiUrl()}/api/users/${encodeURIComponent(email)}/favorites`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    const data = await res.json();
    return Array.isArray(data?.data) ? (data.data as Favorite[]) : [];
  } catch {
    return [];
  }
}

async function saveFavorites(email: string, favorites: Favorite[]): Promise<void> {
  const token = getToken() || '';
  await fetch(`${getApiUrl()}/api/users/${encodeURIComponent(email)}/favorites`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ favorites }),
  });
}

/** Add (or refresh) a favorite, de-duped by id. Returns the updated list. */
export async function addFavorite(email: string, fav: Favorite): Promise<Favorite[]> {
  const current = await getFavorites(email);
  const next = [fav, ...current.filter(f => f.id !== fav.id)];
  await saveFavorites(email, next);
  return next;
}

/** Remove a favorite by id. Returns the updated list. */
export async function removeFavorite(email: string, id: string): Promise<Favorite[]> {
  const current = await getFavorites(email);
  const next = current.filter(f => f.id !== id);
  await saveFavorites(email, next);
  return next;
}
