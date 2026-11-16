const getApiUrl = () => {
  let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (!url.startsWith('http')) {
    if (!url.includes('.')) url = `https://${url}.onrender.com`;
    else url = url.includes('localhost') || url.includes('127.0.0.1') ? `http://${url}` : `https://${url}`;
  }
  return url;
};

const API_URL = getApiUrl();

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export async function apiCall(path: string, init: RequestInit = {}): Promise<any> {
  const headers = new Headers(init.headers || {});
  const token = getToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  });

  const rawText = await response.text();
  let data: any = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText };
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || `Request failed (${response.status})`);
  }

  return data;
}

export interface User {
  id?: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  provider?: string;
  picture?: string;
  role?: 'client' | 'listener' | 'therapist' | 'admin';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data?: { user: User; token: string; needsProfile?: boolean };
  error?: string;
}

export async function completeProfile(name: string, displayName: string, token: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/complete-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name, displayName }),
  });
  return res.json();
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
}

export async function registerUser(name: string, email: string, password: string, phone = ''): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, phone }),
  });
  return res.json();
}

export async function sendOTP(email: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_URL}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
}

export async function verifyOTP(email: string, otp: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code: otp }),
  });
  return res.json();
}

export async function sendMobileOTP(phone: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_URL}/api/auth/send-mobile-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone }),
  });
  return res.json();
}

export async function verifyMobileOTP(phone: string, otp: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/verify-mobile-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp }),
  });
  return res.json();
}

export function getGoogleAuthUrl(): string {
  return `${API_URL}/api/auth/google`;
}

export function getRoleDashboard(role?: string): string {
  if (role === 'listener') return '/listener';
  if (role === 'therapist') return '/therapist';
  return '/dashboard';
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
    const token = getToken();
    const tokenUser = token ? getUserFromToken(token) : null;
    if (raw) {
      const cachedUser = JSON.parse(raw) as User;
      // localStorage and sessionStorage can belong to different sign-ins
      // (for example, after switching accounts in another tab). Never pair
      // one account's cached email/role with another account's auth token.
      if (tokenUser?.email && cachedUser?.email?.toLowerCase() !== tokenUser.email.toLowerCase()) {
        return tokenUser;
      }
      return cachedUser;
    }
    return tokenUser;
  } catch {
    const token = getToken();
    return token ? getUserFromToken(token) : null;
  }
}

export function saveUser(user: User, token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('authToken', token);
  sessionStorage.setItem('authToken', token);
  localStorage.setItem('currentUser', JSON.stringify(user));
  sessionStorage.setItem('currentUser', JSON.stringify(user));
}

export function clearUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('authToken');
  localStorage.removeItem('currentUser');
  sessionStorage.removeItem('currentUser');
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

export function getUserFromToken(token: string): User | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.email) return null;
  return {
    id: payload.userId || payload.id || payload._id,
    _id: payload.userId || payload.id || payload._id,
    email: payload.email,
    name: payload.name || payload.displayName || payload.email.split('@')[0] || 'User',
    phone: payload.phone,
    role: payload.role || 'user',
    provider: payload.provider,
    picture: payload.picture,
  };
}

export async function verifyAndRefreshUser(): Promise<User | null> {
  const user = getCurrentUser();
  if (!user?.email) {
    const token = getToken();
    const tokenUser = token ? getUserFromToken(token) : null;
    if (!tokenUser?.email) return null;
    return tokenUser;
  }
  try {
    const token = getToken();
    const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.email)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return user;
    const data = await res.json();
    if (!data.success || !data.data) return user;
    const fresh: User = {
      ...user,
      role: data.data.role,
      name: data.data.name || user.name,
      picture: data.data.picture || user.picture,
    };
    saveUser(fresh, token || '');
    return fresh;
  } catch {
    return user;
  }
}
