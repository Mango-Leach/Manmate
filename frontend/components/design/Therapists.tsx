'use client';
import React from 'react';
import { Icon, Avatar, Pill, Button, GlobalHeader, type UserInfo } from './primitives';
import { getCurrentUser } from '@/lib/api';

const TONES = ['sage', 'lavender', 'peach', 'rose', 'sky', 'moss'] as const;
type Tone = typeof TONES[number];

interface TherapistAPI {
  id: string;
  _id?: string;
  name: string;
  title?: string;
  description?: string;
  specialties: string[];
  pricePerMin: number;
  rating: number;
  experience?: string;
  googleCalendarConnected?: boolean;
}

interface TherapistUI extends TherapistAPI {
  tone: Tone;
}

const SPECIALTY_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'anxiety', label: 'Anxiety' },
  { id: 'trauma', label: 'Trauma' },
  { id: 'relationships', label: 'Relationships' },
  { id: 'depression', label: 'Depression' },
  { id: 'cbt', label: 'CBT' },
];

function assignTone(index: number): Tone {
  return TONES[index % TONES.length];
}

function getApiUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (raw.startsWith('http')) return raw;
  if (!raw.includes('.')) return `https://${raw}.onrender.com`;
  return raw.includes('localhost') || raw.includes('127.0.0.1') ? `http://${raw}` : `https://${raw}`;
}

export function Therapists({ user }: { user: UserInfo | null }) {
  const [therapists, setTherapists] = React.useState<TherapistUI[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [selected, setSelected] = React.useState<TherapistUI | null>(null);
  const [filter, setFilter] = React.useState('all');
  const [search, setSearch] = React.useState('');

  React.useEffect(() => {
    fetch(`${getApiUrl()}/api/therapists`)
      .then(r => r.json())
      .then(res => {
        if (res?.success && Array.isArray(res.data)) {
          setTherapists(
            res.data.map((t: TherapistAPI, i: number) => ({
              ...t,
              id: t.id || t._id || '',
              specialties: Array.isArray(t.specialties) ? t.specialties : [],
              tone: assignTone(i),
            }))
          );
        } else {
          setError('Could not load therapists. Please try again later.');
        }
      })
      .catch(() => setError('Network error. Please check your connection.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = therapists.filter(t => {
    const matchesFilter =
      filter === 'all' ||
      t.specialties.some(s => s.toLowerCase().includes(filter.toLowerCase()));
    const matchesSearch =
      !search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.specialties.some(s => s.toLowerCase().includes(search.toLowerCase())) ||
      (t.title || '').toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <GlobalHeader user={user} />
      <div className="dash-pad">
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 32, animation: 'fadeUp 0.4s ease both' }}>
            <Pill tone="sage" style={{ marginBottom: 16 }}>
              {loading ? 'Loading…' : `${therapists.length} verified therapist${therapists.length !== 1 ? 's' : ''}`}
            </Pill>
            <h1 className="serif" style={{ fontSize: 'clamp(28px, 5vw, 52px)', margin: 0, fontWeight: 400, letterSpacing: -0.015, lineHeight: 1.05 }}>
              Find someone who <em style={{ fontStyle: 'italic', color: 'var(--sage)' }}>fits</em>.
            </h1>
            <p style={{ fontSize: 17, color: 'var(--ink-2)', maxWidth: 560, marginTop: 16 }}>
              Every therapist here is licensed, background-checked, and reviewed by real clients. Sessions happen on Google Meet.
            </p>
          </div>

          {/* Search + filters */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28, animation: 'fadeUp 0.4s ease 0.05s both' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 18px', borderRadius: 14,
              background: 'var(--card)', border: '1px solid var(--line)',
            }}>
              {Icon.search(18)}
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, specialty, or title"
                style={{
                  flex: 1, border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 14, color: 'var(--ink)', fontFamily: 'inherit',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>
            <div className="tabs-row">
              {SPECIALTY_FILTERS.map(f => (
                <button key={f.id} onClick={() => setFilter(f.id)} style={{
                  padding: '10px 16px', borderRadius: 999, flexShrink: 0,
                  border: `1px solid ${filter === f.id ? 'var(--sage)' : 'var(--line)'}`,
                  background: filter === f.id ? 'var(--sage-soft)' : 'var(--card)',
                  color: filter === f.id ? 'var(--sage)' : 'var(--ink-2)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  transition: 'all 0.15s',
                }}>{f.label}</button>
              ))}
            </div>
          </div>

          {/* States */}
          {loading && (
            <div className="g3">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{
                  background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20,
                  padding: 24, height: 280, animation: 'pulse 1.5s ease infinite',
                  opacity: 0.6,
                }} />
              ))}
            </div>
          )}

          {!loading && error && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--alert)', marginBottom: 16 }}>{error}</div>
              <button onClick={() => window.location.reload()} style={{
                padding: '10px 20px', borderRadius: 12, border: '1px solid var(--line)',
                background: 'var(--bg)', color: 'var(--ink)', cursor: 'pointer', fontSize: 14,
              }}>Retry</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
              <div className="serif" style={{ fontSize: 22, color: 'var(--muted)', fontWeight: 400 }}>No therapists match your search.</div>
              <button onClick={() => { setSearch(''); setFilter('all'); }} style={{
                marginTop: 16, background: 'none', border: 'none', color: 'var(--sage)', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              }}>Clear filters</button>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="g3">
              {filtered.map((t, i) => (
                <TherapistCard key={t.id} t={t} index={i} onClick={() => setSelected(t)} />
              ))}
            </div>
          )}

        </div>
      </div>

      {selected && <BookingModal t={selected} user={user} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Card ────────────────────────────────────────────────────────────────────────

function TherapistCard({ t, index, onClick }: { t: TherapistUI; index: number; onClick: () => void }) {
  const [hover, setHover] = React.useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 20, padding: 24, cursor: 'pointer',
        transition: 'all 0.2s',
        transform: hover ? 'translateY(-3px)' : 'none',
        boxShadow: hover ? '0 18px 36px rgba(31,42,36,0.08)' : 'none',
        animation: `fadeUp 0.4s ease ${index * 0.06}s both`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
        <Avatar name={t.name} tone={t.tone} size={64} />
        <div style={{ flex: 1 }}>
          <div className="serif" style={{ fontSize: 20, fontWeight: 500 }}>{t.name}</div>
          {t.title && <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{t.title}{t.experience ? ` · ${t.experience}` : ''}</div>}
          {t.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: 13, color: 'var(--ink-2)' }}>
              {Icon.star(13, 'var(--peach)')} <strong>{t.rating.toFixed(1)}</strong>
            </div>
          )}
        </div>
      </div>

      {t.description && (
        <p className="serif" style={{ fontSize: 15, color: 'var(--ink-2)', margin: '0 0 16px', lineHeight: 1.5, fontStyle: 'italic' }}>
          &ldquo;{t.description}&rdquo;
        </p>
      )}

      {t.specialties.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {t.specialties.map(s => <Pill key={s}>{s}</Pill>)}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--line-2)' }}>
        <div>
          {t.googleCalendarConnected !== undefined && (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Calendar</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: t.googleCalendarConnected ? 'var(--sage)' : 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {t.googleCalendarConnected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)', display: 'inline-block' }} />}
                {t.googleCalendarConnected ? 'Synced' : 'Contact to book'}
              </div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <span className="serif" style={{ fontSize: 22, fontWeight: 500 }}>₹{t.pricePerMin.toLocaleString()}</span>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>per session · 50 min</div>
        </div>
      </div>
    </div>
  );
}

// ── Booking Modal ────────────────────────────────────────────────────────────────

const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

function BookingModal({ t, user, onClose }: { t: TherapistUI; user: UserInfo | null; onClose: () => void }) {
  const [step, setStep] = React.useState<'pick' | 'confirm' | 'done'>('pick');
  const [date, setDate] = React.useState('');
  const [timeSlot, setTimeSlot] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [clientEmail, setClientEmail] = React.useState(user?.email || '');
  const [clientName, setClientName] = React.useState(user?.name || '');
  const [submitting, setSubmitting] = React.useState(false);
  const [bookingError, setBookingError] = React.useState('');
  const [bookedSlots, setBookedSlots] = React.useState<string[]>([]);
    const [availability, setAvailability] = React.useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = React.useState(false);

  const today = new Date().toISOString().split('T')[0];
  const weekday = date ? new Date(date).toLocaleDateString('en-US', { weekday: 'long' }) : null;
  const dayAvailability = weekday ? (availability[weekday] || []) : [];
  const canProceed = !!date && !!timeSlot && !bookedSlots.includes(timeSlot) && dayAvailability.includes(timeSlot);

  // Fetch the slots already taken for this therapist on the chosen date so we can
  // hide/disable them. Without this, every slot always looks available and two
  // users can pick the same one.
  const fetchBookedSlots = React.useCallback(async () => {
    if (!date) { setBookedSlots([]); return; }
    setLoadingSlots(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/appointments/booked-slots?therapistId=${encodeURIComponent(t.id)}&date=${encodeURIComponent(date)}`
      );
      const data = await res.json();
      setBookedSlots(data?.success ? (data.data?.bookedSlots || []) : []);
    } catch {
      setBookedSlots([]);
    }
    setLoadingSlots(false);
  }, [date, t.id]);

  React.useEffect(() => { fetchBookedSlots(); }, [fetchBookedSlots]);

  // Load therapist availability when modal opens
  React.useEffect(() => {
    if (!t.id) return;
    // Reset availability before fetching new data to avoid stale UI
    setAvailability({});
    const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
    fetch(`${getApiUrl()}/api/therapists/${t.id}/availability`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.success && data?.data?.availability) {
          setAvailability(data.data.availability);
        } else {
          setAvailability({});
        }
      })
      .catch(() => setAvailability({}));
  }, [t.id]);

  const handleBook = async () => {
    if (!canProceed || !clientEmail || !clientName) return;
    setSubmitting(true);
    setBookingError('');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const res = await fetch(`${getApiUrl()}/api/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          therapistId: t.id,
          date,
          timeSlot,
          notes,
          clientEmail,
          clientName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
      } else if (res.status === 401) {
        // Token expired/invalid — clear the stale session and send the user to
        // re-login instead of leaving them stuck on a silent "booking failed".
        setBookingError('Your session has expired. Redirecting you to sign in again…');
        try {
          localStorage.removeItem('authToken');
          sessionStorage.removeItem('authToken');
          localStorage.removeItem('currentUser');
          sessionStorage.removeItem('currentUser');
        } catch {}
        setTimeout(() => {
          if (typeof window !== 'undefined') {
            window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
          }
        }, 1500);
      } else {
        setBookingError(data.error || 'Booking failed. Please try a different slot.');
        // The slot may have just been taken — refresh availability and send the
        // user back to pick a different time.
        if (res.status === 409) {
          setTimeSlot('');
          fetchBookedSlots();
          setStep('pick');
        }
      }
    } catch {
      setBookingError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,20,17,0.5)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 100, padding: 40,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fade-in" style={{
        background: 'var(--bg)', borderRadius: 24, width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflow: 'auto', border: '1px solid var(--line)',
      }}>
        {/* Header */}
        <div style={{ padding: '28px 32px 24px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 16 }}>
          <Avatar name={t.name} tone={t.tone} size={56} />
          <div style={{ flex: 1 }}>
            <div className="serif" style={{ fontSize: 24, fontWeight: 500 }}>{t.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {[t.title, t.specialties.slice(0, 3).join(' · ')].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--line)',
            background: 'var(--card)', cursor: 'pointer', fontSize: 18, color: 'var(--muted)',
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px' }}>

          {step === 'pick' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 10 }}>
                  Choose a date
                </div>
                <input
                  type="date"
                  value={date}
                  min={today}
                  onChange={e => { setDate(e.target.value); setTimeSlot(''); }}
                  style={{
                    width: '100%', padding: '12px 16px', borderRadius: 12,
                    border: '1px solid var(--line)', background: 'var(--card)',
                    color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 10 }}>
                  Choose a time slot
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {TIME_SLOTS.map(ts => {
                    const isBooked = bookedSlots.includes(ts);
                    const isSelected = timeSlot === ts;
                    const isAvailable = dayAvailability.includes(ts);
                    return (
                      <button
                        key={ts}
                        disabled={isBooked || loadingSlots || !isAvailable}
                        onClick={() => setTimeSlot(ts)}
                        title={!date ? 'Choose a date first' : isBooked ? 'Already booked' : !isAvailable ? 'Not available' : ''}
                        style={{
                          padding: '10px 18px',
                          borderRadius: 12,
                          border: `1px solid ${isSelected ? 'var(--sage)' : 'var(--line)'}`,
                          background: isSelected ? 'var(--sage-soft)' : 'var(--card)',
                          color: isBooked ? 'var(--muted)' : !isAvailable ? 'var(--muted)' : isSelected ? 'var(--sage)' : 'var(--ink)',
                          cursor: (isBooked || !isAvailable) ? 'not-allowed' : 'pointer',
                          fontSize: 14,
                          fontWeight: 500,
                          transition: 'all 0.15s',
                          opacity: (isBooked || !isAvailable) ? 0.45 : 1,
                          textDecoration: isBooked ? 'line-through' : 'none',
                        }}
                      >
                        {ts}
                      </button>
                    );
                  })}
                </div>
                {date && !loadingSlots && bookedSlots.length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    Crossed-out times are already booked.
                  </div>
                )}
                {date && dayAvailability.length === 0 && !loadingSlots && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    This therapist is not available on the selected day.
                  </div>
                )}
                {date && loadingSlots && (
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    Checking availability…
                  </div>
                )}
              </div>

              {!user && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Your name</div>
                    <input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full name"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Your email</div>
                    <input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="Email address"
                      style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Notes for the therapist (optional)</div>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What would you like to talk about?"
                  rows={3} style={{
                    width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)',
                    background: 'var(--card)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
                    outline: 'none', resize: 'none', boxSizing: 'border-box',
                  }} />
              </div>

              <div style={{ padding: 16, background: 'var(--bg-2)', borderRadius: 14, fontSize: 13, color: 'var(--ink-2)', display: 'flex', gap: 10, alignItems: 'center' }}>
                {Icon.video(16)} Session on Google Meet. A link will arrive via email 30 minutes before.
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>Confirm booking</div>
              {[
                { label: 'Therapist', value: t.name },
                { label: 'Date', value: formattedDate },
                { label: 'Time', value: timeSlot },
                { label: 'Your name', value: clientName },
                { label: 'Your email', value: clientEmail },
                ...(notes ? [{ label: 'Notes', value: notes }] : []),
              ].map((row, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{row.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', maxWidth: '60%', textAlign: 'right' }}>{row.value}</span>
                </div>
              ))}
              {bookingError && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)', fontSize: 14 }}>
                  {bookingError}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', background: 'var(--sage-soft)',
                color: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
              }}>{Icon.check(32)}</div>
              <h3 className="serif" style={{ fontSize: 32, fontWeight: 400, margin: '0 0 12px', letterSpacing: -0.01 }}>
                Booking request sent.
              </h3>
              <p style={{ color: 'var(--ink-2)', fontSize: 15, margin: 0 }}>
                Your session with {t.name} on {formattedDate} at {timeSlot} is <strong>pending confirmation</strong>. We&apos;ve emailed {clientEmail} — you&apos;ll get another email with the Google Meet link once {t.name} confirms.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '20px 32px', borderTop: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {step !== 'done' && (
              <>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>Total · 50 min session</span>
                <div className="serif" style={{ fontSize: 24, fontWeight: 500 }}>₹{t.pricePerMin.toLocaleString()}</div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {step === 'pick' && (
              <Button tone="primary" size="lg"
                onClick={() => setStep('confirm')}
                style={{ opacity: canProceed ? 1 : 0.5, cursor: canProceed ? 'pointer' : 'not-allowed' }}>
                Continue
              </Button>
            )}
            {step === 'confirm' && (
              <>
                <Button tone="ghost" size="lg" onClick={() => { setStep('pick'); setBookingError(''); }}>Back</Button>
                <Button tone="primary" size="lg" onClick={handleBook} style={{ opacity: submitting ? 0.7 : 1 }}>
                  {submitting ? 'Booking…' : 'Confirm booking'}
                </Button>
              </>
            )}
            {step === 'done' && (
              <Button tone="primary" size="lg" onClick={onClose}>Done</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
