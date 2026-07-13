'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark, Avatar } from '@/components/design/primitives';
import { getCurrentUser, verifyAndRefreshUser, clearUser, apiCall, type User } from '@/lib/api';
import { validateCity, validateBio, validateListenerName } from '@/lib/profileValidators';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  therapist: 'Licensed Therapist',
  listener: 'Peer Listener',
  user: 'Client',
  client: 'Client',
};

const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam', 'Marathi', 'Punjabi', 'Tamil', 'Telugu'];
const GENDERS = ['Prefer not to say', 'Male', 'Female', 'Non-binary'];

interface ProfileExtras { listenerName: string; dob: string; gender: string; city: string; language: string; bio: string; }

const DEFAULT_EXTRAS: ProfileExtras = { listenerName: '', dob: '', gender: 'Prefer not to say', city: '', language: 'English', bio: '' };

/** Today's date in YYYY-MM-DD format — used as the `max` constraint on the DOB picker. */
const todayISO = new Date().toISOString().split('T')[0];

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [extras, setExtras] = useState<ProfileExtras>(DEFAULT_EXTRAS);
  const [draft, setDraft] = useState<ProfileExtras>(DEFAULT_EXTRAS);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const localUser = getCurrentUser();
    if (!localUser) { router.push('/auth/login'); return; }

    verifyAndRefreshUser().then(freshUser => {
      const u = freshUser || localUser;
      setUser(u);

      // Load extras from the fresh user document returned by the API
      apiCall(`/api/users/${encodeURIComponent(u.email)}`).then((res: any) => {
        if (res.success && res.data) {
          const d = res.data;
          const loaded: ProfileExtras = {
            listenerName: d.listenerName || '',
            dob: d.dob || '',
            gender: d.gender || 'Prefer not to say',
            city: d.city || '',
            language: d.language || 'English',
            bio: d.bio || '',
          };
          setExtras(loaded);
          setDraft(loaded);
        }
      }).catch(() => {});

      // Fetch wallet balance
      if (u.role === 'client' || !u.role) {
        apiCall(`/api/users/${encodeURIComponent(u.email)}/wallet`).then((res: any) => {
          if (res.success) setWalletBalance(res.balance ?? 0);
        }).catch(() => setWalletBalance(0));
      }
    }).finally(() => setLoading(false));
  }, [router]);

  const handleSave = async () => {
    if (!user) return;

    // --- Frontend validation (mirrors backend rules in lib/profileValidators.ts) ---
    // Validate in the order they appear on the form so the first error is most visible.

    const nameResult = validateListenerName(draft.listenerName);
    if (!nameResult.valid) { setSaveError(nameResult.message); return; }

    if (draft.dob) {
      const dobDate = new Date(draft.dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dobDate > today) {
        setSaveError('Date of birth cannot be in the future.');
        return;
      }
    }

    const cityResult = validateCity(draft.city);
    if (!cityResult.valid) { setSaveError(cityResult.message); return; }

    const bioResult = validateBio(draft.bio);
    if (!bioResult.valid) { setSaveError(bioResult.message); return; }

    // --- All checks passed — clear any previous error and save ---
    setSaveError('');
    setSaving(true);
    try {
      await apiCall(`/api/users/${encodeURIComponent(user.email)}`, {
        method: 'POST',
        body: JSON.stringify(draft),
      });
      setExtras(draft);
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setSaveError(e.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => { setDraft(extras); setEditing(false); };
  const signOut = () => { clearUser(); router.push('/auth/login'); };

  if (loading || !user) return null;

  const joinDate = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const isClientRole = !user.role || user.role === 'client';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Nav */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--line)', padding: '0 clamp(16px, 4vw, 48px)', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Logo size={40} />
          <Wordmark size={18} />
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => router.push(user.role === 'listener' ? '/listener' : user.role === 'therapist' ? '/therapist' : '/dashboard')}
            style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Dashboard
          </button>
          <button onClick={signOut} style={{
            padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)',
            background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Header card */}
        <div style={{
          background: 'linear-gradient(135deg, var(--sage) 0%, var(--sage-2) 100%)',
          borderRadius: 24, padding: 32, color: '#F5F1E8',
          display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24,
          position: 'relative', overflow: 'hidden',
          animation: 'scaleIn 0.4s ease both',
        }}>
          <div aria-hidden style={{ position: 'absolute', right: -40, bottom: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
          <Avatar name={user.name} tone="moss" size={72} />
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.7, fontWeight: 600, marginBottom: 6 }}>
              {ROLE_LABELS[user.role || 'user'] || 'Client'}
            </div>
            <div className="serif" style={{ fontSize: 32, fontWeight: 400, letterSpacing: -0.01 }}>{user.name}</div>
            <div style={{ fontSize: 14, opacity: 0.75, marginTop: 4 }}>Member since {joinDate}</div>
          </div>
          {isClientRole && (
            <div style={{ marginLeft: 'auto', textAlign: 'right', flexShrink: 0, position: 'relative' }}>
              <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: 1 }}>Wallet</div>
              <div className="serif" style={{ fontSize: 28, fontWeight: 400 }}>
                {walletBalance === null ? '…' : `₹${walletBalance}`}
              </div>
            </div>
          )}
        </div>

        {/* Read-only info */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, marginBottom: 20, animation: 'fadeUp 0.4s ease 0.1s both' }}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>Account info</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {[
              { label: 'Full name', value: user.name },
              { label: 'Email', value: user.email },
              { label: 'Phone', value: user.phone || '—' },
              { label: 'Login method', value: user.provider === 'google' ? 'Google' : 'Email OTP' },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, fontWeight: 500, letterSpacing: 0.5 }}>{f.label.toUpperCase()}</div>
                <div style={{ fontSize: 15, color: 'var(--ink)' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Editable info */}
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, animation: 'fadeUp 0.4s ease 0.2s both' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Personal details</div>
            {!editing ? (
              <button onClick={() => setEditing(true)} style={{
                padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)',
                background: 'var(--bg)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              }}>Edit</button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleCancel} style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} style={{ padding: '7px 16px', borderRadius: 10, border: 'none', background: 'var(--sage)', color: '#FBF8F0', fontSize: 13, fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </div>

          {saved && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'var(--sage-soft)', color: 'var(--sage)', fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              Profile saved successfully.
            </div>
          )}

          {saveError && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fef2f2', color: '#dc2626', fontSize: 14, marginBottom: 16 }}>
              {saveError}
            </div>
          )}

          {/* Display name — full width row */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>DISPLAY NAME (shown to listeners)</label>
            {editing ? (
              <>
                <input
                  type="text" value={draft.listenerName}
                  onChange={e => setDraft(d => ({ ...d, listenerName: e.target.value }))}
                  placeholder={`e.g. ${user?.name?.split(' ')[0] || 'a nickname'}`}
                  style={inputStyle}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
                  This is what your listener sees when you connect — not your real name.
                </div>
              </>
            ) : (
              <div style={{ fontSize: 15, color: extras.listenerName ? 'var(--ink)' : 'var(--muted)' }}>
                {extras.listenerName || user?.name?.split(' ')[0] || '—'}
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Date of birth */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>DATE OF BIRTH</label>
              {editing ? (
                <input
                  type="date"
                  value={draft.dob}
                  max={todayISO}
                  onChange={e => setDraft(d => ({ ...d, dob: e.target.value }))}
                  style={inputStyle}
                />
              ) : <div style={{ fontSize: 15, color: extras.dob ? 'var(--ink)' : 'var(--muted)' }}>{extras.dob || '—'}</div>}
            </div>
            {/* Gender */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>GENDER</label>
              {editing ? (
                <select value={draft.gender} onChange={e => setDraft(d => ({ ...d, gender: e.target.value }))} style={inputStyle}>
                  {GENDERS.map(g => <option key={g}>{g}</option>)}
                </select>
              ) : <div style={{ fontSize: 15, color: 'var(--ink)' }}>{extras.gender}</div>}
            </div>
            {/* City */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>CITY</label>
              {editing ? (
                <input type="text" value={draft.city} onChange={e => setDraft(d => ({ ...d, city: e.target.value }))} placeholder="Your city" style={inputStyle} />
              ) : <div style={{ fontSize: 15, color: extras.city ? 'var(--ink)' : 'var(--muted)' }}>{extras.city || '—'}</div>}
            </div>
            {/* Language */}
            <div>
              <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>PREFERRED LANGUAGE</label>
              {editing ? (
                <select value={draft.language} onChange={e => setDraft(d => ({ ...d, language: e.target.value }))} style={inputStyle}>
                  {LANGUAGES.map(l => <option key={l}>{l}</option>)}
                </select>
              ) : <div style={{ fontSize: 15, color: 'var(--ink)' }}>{extras.language}</div>}
            </div>
          </div>

          {/* Bio */}
          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>BIO</label>
            {editing ? (
              <textarea value={draft.bio} onChange={e => setDraft(d => ({ ...d, bio: e.target.value }))}
                placeholder="A little about yourself…" rows={3}
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Newsreader, Georgia, serif', lineHeight: 1.6 }} />
            ) : <div style={{ fontSize: 15, color: extras.bio ? 'var(--ink)' : 'var(--muted)', lineHeight: 1.6 }}>{extras.bio || '—'}</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: '1px solid var(--line)', background: 'var(--bg)',
  color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none',
  boxSizing: 'border-box',
};
