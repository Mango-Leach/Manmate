'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark, Avatar, type UserInfo } from './primitives';
import { clearUser, getToken } from '@/lib/api';

type ApptStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
interface Appointment {
  _id: string; clientName: string; clientPhone?: string;
  date: string; slot: string; status: ApptStatus; notes?: string;
}
// Raw shape returned by GET /api/appointments/therapist
interface BackendAppointment {
  _id: string; date: string; timeSlot: string; status: ApptStatus;
  notes?: string; whatsappNumber?: string;
  userId?: { _id?: string; name?: string; email?: string };
}
interface TherapistAnalytics {
  totalSessions: number; completedSessions: number; confirmedSessions: number;
  pendingSessions: number; cancelledSessions: number; sessionsThisMonth: number;
  rating: number; name: string; title?: string; experience?: string; specialties?: string[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

function formatApptDate(d: string): string {
  if (!d) return '';
  const parsed = new Date(d);
  if (isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_COLORS: Record<ApptStatus, { bg: string; c: string; label: string }> = {
  pending: { bg: '#FEF3C7', c: '#92400E', label: 'Pending' },
  confirmed: { bg: 'var(--sage-soft)', c: 'var(--sage)', label: 'Confirmed' },
  completed: { bg: 'var(--bg-2)', c: 'var(--muted)', label: 'Completed' },
  cancelled: { bg: '#FEE2E2', c: '#991B1B', label: 'Cancelled' },
};

export function TherapistDashboard({ user }: { user: UserInfo }) {
  const router = useRouter();
  const [therapistName, setTherapistName] = useState(user.name);
  const [tab, setTab] = useState<'appointments' | 'availability' | 'calendar' | 'analytics'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [availability, setAvailability] = useState<Record<string, string[]>>(
    Object.fromEntries(DAYS.map(d => [d, []]))
  );
  const [calConnected, setCalConnected] = useState(false);
  const [calEmail, setCalEmail] = useState<string | null>(null);
  const [autoMeet, setAutoMeet] = useState(false); // loaded from server calendar status (T-4)
  const [analytics, setAnalytics] = useState<TherapistAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [rescheduleModal, setRescheduleModal] = useState<{ id: string } | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleSlot, setRescheduleSlot] = useState('09:00');
  const [toast, setToast] = useState('');

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const token = getToken();
  const headers = React.useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);
  const callbackProcessedRef = React.useRef(false);

  const fetchCalendarStatus = React.useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/therapists/calendar/status`, { headers }).then(r => r.json());
      if (res.success) {
        setCalConnected(res.connected);
        setCalEmail(res.email);
        // Auto-Meet is a persisted server-side preference and can only be on
        // while the calendar is actually connected (T-4).
        setAutoMeet(res.connected ? res.autoCreateMeet !== false : false);
      } else {
        // A failed/404 status means we cannot verify a connection — never show
        // "Connected" without server confirmation (T-3).
        setCalConnected(false);
        setCalEmail(null);
        setAutoMeet(false);
      }
    } catch (err) {
      console.error('[Calendar] failed to fetch status:', err);
    }
  }, [apiUrl, headers]);

  useEffect(() => {
    Promise.all([
      fetch(`${apiUrl}/api/appointments/therapist`, { headers, cache: 'no-store' }).then(r => r.json()).catch(() => ({ data: [] })),
      fetch(`${apiUrl}/api/therapists/profile`, { headers, cache: 'no-store' }).then(r => r.json()).catch(() => null),
    ]).then(([appts, profile]) => {
      if (appts?.data) {
        // Map backend shape (timeSlot, userId.{name,email}, whatsappNumber)
        // to the UI's appointment shape.
        setAppointments(appts.data.map((a: BackendAppointment): Appointment => ({
          _id: a._id,
          clientName: a.userId?.name || 'Client',
          clientPhone: a.whatsappNumber || '',
          date: a.date,
          slot: a.timeSlot,
          status: a.status,
          notes: a.notes,
        })));
      }
      if (profile?.data?.availability) setAvailability(profile.data.availability);
      if (profile?.data?.name) setTherapistName(profile.data.name);
      setLoading(false);
    });
    fetchCalendarStatus();
  }, [apiUrl, headers, fetchCalendarStatus]);

  useEffect(() => {
    const refreshProfile = () => {
      fetch(`${apiUrl}/api/therapists/profile`, { headers, cache: 'no-store' })
        .then(r => r.json())
        .then(profile => {
          if (profile?.success && profile.data) {
            if (profile.data.name) setTherapistName(profile.data.name);
            if (profile.data.availability) setAvailability(profile.data.availability);
          }
        })
        .catch(() => null);
    };
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') refreshProfile(); };
    window.addEventListener('focus', refreshProfile);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.removeEventListener('focus', refreshProfile);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [apiUrl, headers]);

  // Handle OAuth callback parameters idempotently
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (callbackProcessedRef.current) return;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');

    if (!code && !state && !error) return;

    // Mark as processed immediately to prevent duplicate runs in Strict Mode
    callbackProcessedRef.current = true;

    // Clear parameters from address bar immediately to prevent subsequent renders from parsing them again
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);

    if (code && state) {
      (async () => {
        showToast('Connecting Google Calendar…');
        try {
          const res = await fetch(`${apiUrl}/api/therapists/calendar/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, therapistId: state }),
          }).then(r => r.json());

          if (res.success) {
            showToast('Google Calendar connected successfully!');
            setCalConnected(true);
            setCalEmail(res.email);
            // Pull the persisted auto-Meet preference now that we're connected
            fetchCalendarStatus();
          } else {
            showToast(res.error || 'Failed to connect Google Calendar');
            fetchCalendarStatus();
          }
        } catch (err) {
          showToast('Connection failed. Please check your network and try again.');
          fetchCalendarStatus();
        }
      })();
    } else if (error) {
      if (error === 'access_denied') {
        showToast('Connection canceled: access denied by user.');
      } else {
        showToast(`Connection failed: ${error}`);
      }
    }
  }, [apiUrl, fetchCalendarStatus]);

  const handleCalendarToggle = async () => {
  if (calConnected) {
    // Disconnect
    try {
      const res = await fetch(`${apiUrl}/api/therapists/calendar/disconnect`, {
        method: 'DELETE',
        headers,
      }).then(r => r.json());
      if (res.success) {
        // Refresh calendar status to update UI state
        await fetchCalendarStatus();
        showToast('Google Calendar disconnected');
      } else {
        showToast(res.error || 'Failed to disconnect Google Calendar');
      }
    } catch (err) {
      showToast('Failed to disconnect Google Calendar');
    }
  } else {
    // Connect
      try {
        const res = await fetch(`${apiUrl}/api/therapists/calendar/auth-url`, {
          headers,
        }).then(r => r.json());
        if (res.success && res.authUrl) {
          window.location.href = res.authUrl;
        } else {
          showToast(res.error || 'Failed to get connection link');
        }
      } catch (err) {
        showToast('Failed to connect Google Calendar');
      }
    }
  };

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  // Persist the auto-Meet preference so it survives reloads and is honored by
  // the backend when confirming appointments (T-4).
  const handleAutoMeetToggle = async () => {
    if (!calConnected) return;
    const next = !autoMeet;
    setAutoMeet(next); // optimistic
    try {
      const res = await fetch(`${apiUrl}/api/therapists/profile`, {
        method: 'PUT', headers, body: JSON.stringify({ autoCreateMeet: next }),
      }).then(r => r.json());
      if (!res.success) {
        setAutoMeet(!next);
        showToast(res.error || 'Could not save setting.');
      } else {
        showToast(next ? 'Auto Google Meet enabled' : 'Auto Google Meet disabled');
      }
    } catch {
      setAutoMeet(!next);
      showToast('Could not save setting. Check your connection.');
    }
  };

  const loadAnalytics = async () => {
    if (analytics) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${apiUrl}/api/therapists/analytics/me`, { headers }).then(r => r.json());
      if (res?.success && res.data?.analytics) setAnalytics(res.data.analytics);
    } catch { /* silent */ }
    setAnalyticsLoading(false);
  };

  const updateStatus = async (id: string, action: 'confirm' | 'complete' | 'cancel') => {
    const status: ApptStatus =
      action === 'confirm' ? 'confirmed' : action === 'complete' ? 'completed' : 'cancelled';
    try {
      const res = await fetch(`${apiUrl}/api/appointments/${id}/status`, {
        method: 'PUT', headers, body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Action failed. Please try again.'); return; }
      setAppointments(prev => prev.map(a => a._id === id ? { ...a, status } : a));
      showToast(`Appointment ${action}ed`);
    } catch { showToast('Action failed. Please try again.'); }
  };

  const handleReschedule = async () => {
    if (!rescheduleModal || !rescheduleDate) return;
    try {
      const res = await fetch(`${apiUrl}/api/appointments/${rescheduleModal.id}/reschedule`, {
        method: 'PUT', headers, body: JSON.stringify({ date: rescheduleDate, timeSlot: rescheduleSlot }),
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || 'Reschedule failed.'); return; }
      setAppointments(prev => prev.map(a =>
        a._id === rescheduleModal.id
          ? { ...a, status: 'confirmed', date: rescheduleDate, slot: rescheduleSlot }
          : a));
      showToast('Appointment rescheduled');
      setRescheduleModal(null);
    } catch { showToast('Reschedule failed.'); }
  };

  const saveAvailability = async () => {
    try {
      await fetch(`${apiUrl}/api/therapists/profile`, { method: 'PUT', headers, body: JSON.stringify({ availability }) });
      showToast('Availability saved');
    } catch { showToast('Save failed.'); }
  };

  const toggleSlot = (day: string, slot: string) => {
    setAvailability(prev => {
      const slots = prev[day] || [];
      const next = slots.includes(slot) ? slots.filter(s => s !== slot) : [...slots, slot];
      return { ...prev, [day]: next };
    });
  };

  const signOut = () => { clearUser(); router.push('/auth/login'); };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <DashboardNav name={therapistName} onSignOut={signOut} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: '#FBF8F0', padding: '10px 20px', borderRadius: 12,
          fontSize: 14, fontWeight: 500, zIndex: 200, animation: 'fadeUp 0.3s ease',
        }}>{toast}</div>
      )}

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Page header */}
        <div className="flex-sb" style={{ marginBottom: 32, animation: 'fadeUp 0.4s ease both', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--sage)', fontWeight: 600, marginBottom: 8 }}>Therapist Portal</div>
            <h1 className="serif" style={{ fontSize: 'clamp(26px, 4vw, 42px)', margin: 0, fontWeight: 400, letterSpacing: -0.015 }}>
              Dr. <em style={{ color: 'var(--sage)', fontStyle: 'italic' }}>{therapistName.split(' ').slice(-1)[0]}</em>&apos;s workspace
            </h1>
          </div>
          <div className="tabs-row">
            {(['appointments', 'availability', 'calendar', 'analytics'] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); if (t === 'analytics') loadAnalytics(); }} style={{
                padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: tab === t ? 'var(--sage)' : 'var(--card)',
                color: tab === t ? '#FBF8F0' : 'var(--muted)',
                outline: tab === t ? 'none' : '1px solid var(--line)',
                fontSize: 13, fontWeight: 500, textTransform: 'capitalize',
                transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
              }}>{t}</button>
            ))}
          </div>
        </div>

        {/* Appointments tab */}
        {tab === 'appointments' && (
          <div style={{ animation: 'fadeUp 0.35s ease both' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading appointments…</div>
            ) : appointments.length === 0 ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                <div className="serif" style={{ fontSize: 22, color: 'var(--muted)', fontWeight: 400 }}>No appointments yet</div>
                <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 8 }}>Your upcoming sessions will appear here.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {appointments.map((a, i) => {
                  const sc = STATUS_COLORS[a.status];
                  return (
                    <div key={a._id} style={{
                      background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18,
                      padding: 24, display: 'flex', alignItems: 'center', gap: 20,
                      animation: `fadeUp 0.3s ease ${i * 0.06}s both`,
                    }}>
                      <Avatar name={a.clientName} tone="sage" size={48} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 16 }}>{a.clientName}</span>
                          <span style={{ padding: '3px 10px', borderRadius: 999, background: sc.bg, color: sc.c, fontSize: 11, fontWeight: 600 }}>{sc.label}</span>
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{formatApptDate(a.date)} · {a.slot}</div>
                        {a.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, fontStyle: 'italic' }}>{a.notes}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {a.status === 'pending' && <>
                          <ActionBtn label="Confirm" color="var(--sage)" onClick={() => updateStatus(a._id, 'confirm')} />
                          <ActionBtn label="Cancel" color="var(--alert)" onClick={() => updateStatus(a._id, 'cancel')} />
                          {a.clientPhone && <ActionBtn label="WhatsApp" color="#25D366" onClick={() => window.open(`https://wa.me/${a.clientPhone}`, '_blank')} />}
                        </>}
                        {a.status === 'confirmed' && (() => {
                          // Only allow completion on or after the appointment date (date part only, ignore time)
                          const apptDate = new Date(a.date);
                          apptDate.setHours(0, 0, 0, 0);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const canComplete = today >= apptDate;
                          return (
                            <>
                              <ActionBtn label="Reschedule" color="var(--lavender)" onClick={() => { setRescheduleModal({ id: a._id }); setRescheduleDate(''); }} />
                              {canComplete && (
                                <ActionBtn label="Complete" color="var(--sage)" onClick={() => updateStatus(a._id, 'complete')} />
                              )}
                              <ActionBtn label="Cancel" color="var(--alert)" onClick={() => updateStatus(a._id, 'cancel')} />
                              {a.clientPhone && <ActionBtn label="WhatsApp" color="#25D366" onClick={() => window.open(`https://wa.me/${a.clientPhone}`, '_blank')} />}
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Availability tab */}
        {tab === 'availability' && (
          <div style={{ animation: 'fadeUp 0.35s ease both' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, marginBottom: 20 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 6 }}>Weekly Availability</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>Click a slot to toggle availability. Green = available.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
                {DAYS.map(day => (
                  <div key={day}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, textAlign: 'center' }}>{day.slice(0, 3)}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {TIME_SLOTS.map(slot => {
                        const active = (availability[day] || []).includes(slot);
                        return (
                          <button key={slot} onClick={() => toggleSlot(day, slot)} style={{
                            padding: '6px 4px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
                            background: active ? 'var(--sage-soft)' : 'var(--bg)',
                            color: active ? 'var(--sage)' : 'var(--muted)',
                            outline: `1px solid ${active ? 'var(--sage)' : 'var(--line)'}`,
                            transition: 'all 0.18s',
                          }}>{slot}</button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={saveAvailability} style={{
                  padding: '11px 28px', borderRadius: 12, border: 'none',
                  background: 'var(--sage)', color: '#FBF8F0', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}>Save Availability</button>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Settings tab */}
        {tab === 'calendar' && (
          <div style={{ animation: 'fadeUp 0.35s ease both' }}>
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 32, maxWidth: 560 }}>
              <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 24 }}>Google Calendar</div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 20, borderRadius: 14, background: 'var(--bg)', border: '1px solid var(--line)', marginBottom: 20 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: calConnected ? 'var(--sage-soft)' : 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                  📅
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', marginBottom: 2 }}>Google Calendar</div>
                  <div style={{ fontSize: 13, color: calConnected ? 'var(--sage)' : 'var(--muted)' }}>
                    {calConnected ? `✓ Connected (${calEmail || ''})` : 'Not connected'}
                  </div>
                </div>
                <button onClick={handleCalendarToggle} style={{
                  padding: '9px 18px', borderRadius: 10, border: '1px solid var(--line)',
                  background: calConnected ? 'var(--alert)' : 'var(--sage)',
                  color: '#FBF8F0', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}>
                  {calConnected ? 'Disconnect' : 'Connect'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderRadius: 14, background: 'var(--bg)', border: '1px solid var(--line)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--ink)', marginBottom: 2 }}>Auto-create Google Meet links</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>Automatically generate Meet links for confirmed appointments</div>
                </div>
                <button
                  onClick={handleAutoMeetToggle}
                  disabled={!calConnected}
                  aria-pressed={autoMeet}
                  style={{
                    width: 48,
                    height: 26,
                    borderRadius: 999,
                    border: 'none',
                    cursor: calConnected ? 'pointer' : 'not-allowed',
                    position: 'relative',
                    background: autoMeet ? 'var(--sage)' : 'var(--bg-2)',
                    transition: 'background 0.3s',
                    boxShadow: 'inset 0 0 0 1px var(--line)',
                    opacity: calConnected ? 1 : 0.5,
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      top: 3,
                      left: autoMeet ? 24 : 3,
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: '#FBF8F0',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      transition: 'left 0.3s',
                    }}
                  />
                </button>
                {!calConnected && (
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
                    Connect Google Calendar to enable automatic Google Meet creation.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {/* Analytics tab */}
        {tab === 'analytics' && (
          <div style={{ animation: 'fadeUp 0.35s ease both' }}>
            {analyticsLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>Loading analytics…</div>
            ) : !analytics ? (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>No analytics data available yet.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {/* Sessions overview */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28, gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 20 }}>Session overview</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                    {[
                      { label: 'Total', value: analytics.totalSessions, color: 'var(--ink)' },
                      { label: 'Completed', value: analytics.completedSessions, color: 'var(--sage)' },
                      { label: 'Confirmed', value: analytics.confirmedSessions, color: 'var(--lavender)' },
                      { label: 'Pending', value: analytics.pendingSessions, color: '#92400E' },
                      { label: 'Cancelled', value: analytics.cancelledSessions, color: 'var(--alert)' },
                    ].map((s, i) => (
                      <div key={i} style={{ textAlign: 'center', padding: '16px 8px', borderRadius: 14, background: 'var(--bg)', border: '1px solid var(--line-2)' }}>
                        <div className="serif" style={{ fontSize: 36, fontWeight: 400, color: s.color, marginBottom: 4 }}>{s.value}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {/* This month */}
                <div style={{ background: 'linear-gradient(140deg, var(--sage) 0%, var(--sage-2) 100%)', borderRadius: 20, padding: 28, color: '#FBF8F0', position: 'relative', overflow: 'hidden' }}>
                  <div aria-hidden style={{ position: 'absolute', right: -40, bottom: -40, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
                  <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.75, fontWeight: 500, marginBottom: 12 }}>This month</div>
                  <div className="serif" style={{ fontSize: 52, fontWeight: 400, letterSpacing: -0.01 }}>{analytics.sessionsThisMonth}</div>
                  <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>sessions booked</div>
                </div>
                {/* Rating */}
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 28 }}>
                  <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 12 }}>Rating</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <div className="serif" style={{ fontSize: 52, fontWeight: 400, color: 'var(--sage)' }}>
                      {analytics.rating ? analytics.rating.toFixed(1) : '—'}
                    </div>
                    {analytics.rating > 0 && <div style={{ fontSize: 14, color: 'var(--muted)' }}>/ 5.0</div>}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Average client rating</div>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Reschedule modal */}
      {rescheduleModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24,
        }} onClick={() => setRescheduleModal(null)}>
          <div style={{
            background: 'var(--card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 420,
            animation: 'slideUp 0.3s ease',
          }} onClick={e => e.stopPropagation()}>
            <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: '0 0 20px' }}>Reschedule Appointment</h3>
            <label style={labelStyle}>New Date</label>
            <input type="date" value={rescheduleDate} onChange={e => setRescheduleDate(e.target.value)} style={{ ...inputStyle, marginBottom: 14 }} />
            <label style={labelStyle}>Time Slot</label>
            <select value={rescheduleSlot} onChange={e => setRescheduleSlot(e.target.value)} style={{ ...inputStyle, marginBottom: 24 }}>
              {TIME_SLOTS.map(s => <option key={s}>{s}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setRescheduleModal(null)} style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleReschedule} disabled={!rescheduleDate} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--sage)', color: '#FBF8F0', fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: rescheduleDate ? 1 : 0.5 }}>Reschedule</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
      background: color, color: '#FBF8F0', fontSize: 12, fontWeight: 600,
      transition: 'opacity 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >{label}</button>
  );
}

function DashboardNav({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const router = useRouter();
  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--line)', padding: '0 clamp(16px, 4vw, 48px)', height: 60,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={40} />
        <Wordmark size={18} />
        <span style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 999, background: 'var(--sage-soft)', color: 'var(--sage)', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>Therapist</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/profile')} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Profile</button>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{name}</span>
        <button onClick={onSignOut} style={{
          padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)',
          background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}

const labelStyle: React.CSSProperties = { fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
