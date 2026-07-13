'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Logo, Wordmark, Avatar, type UserInfo } from './primitives';
import { clearUser, getToken } from '@/lib/api';

interface ListenerRow { _id: string; name: string; email: string; isAvailable: boolean; totalCalls: number; totalMinutes: number; rating: number; specialties: string[] | string; bio: string; costPerMin?: number; createdAt?: string; }
interface TherapistRow { _id: string; name: string; email: string; title: string; rate: number; experience: string; rating: number; specialties: string[] | string; description: string; credentials: string; gender?: string; }
interface TranscriptSegment { id?: number; start: number | null; end: number | null; text: string; }
interface TranscriptRow { id: string; sessionId: string; callId?: string | null; speaker: string; text: string; segments?: TranscriptSegment[]; confidence: number; processor: string; model?: string | null; audioPath?: string | null; createdAt: string; }
interface ConversationTurn { speaker: string; start: number | null; end: number | null; text: string; }
interface ListenerAnalytics { id: string; name: string; email: string; isAvailable: boolean; totalCalls: number; totalMinutes: number; totalHours: number; avgDuration?: number; rating: number; estimatedEarnings: number; payRatePerMinute: number; costPerMin?: number; joinedAt?: string; specialties: string[]; bio: string; isFiltered?: boolean; }
interface TherapistAnalytics { id: string; name: string; email: string; title: string; specialties: string[]; experience: string; rating: number; rate: number; totalSessions: number; completedSessions: number; confirmedSessions: number; pendingSessions: number; cancelledSessions: number; sessionsThisMonth: number; joinedAt?: string; isFiltered?: boolean; filtered?: boolean; }
interface AISettings { companionName: string; greeting: string; systemPrompt: string; ttsModel: string; voice: string; language: string; sttModel: string; pitch: number; pace: number; loudness: number; vadThreshold: number; silenceTimeout: number; minSpeechDuration: number; maxTokens: number; temperature: number; }
interface ReportRow { _id: string; reporterEmail: string; reporterName: string; reportedUser: string; reportedEmail?: string; sessionId: string | null; reason: string; details: string; status: 'pending' | 'warned' | 'reviewed' | 'dismissed' | 'suspended'; warningSent?: boolean; createdAt: string; }

const TTS_MODELS = ['bulbul:v2', 'bulbul:v3', 'bulbul:v3-beta'];
const LANGUAGES = ['en-IN', 'hi-IN', 'bn-IN', 'gu-IN', 'kn-IN', 'ml-IN', 'mr-IN', 'pa-IN', 'ta-IN', 'te-IN'];
const LANG_LABELS: Record<string, string> = { 'en-IN': 'English (India)', 'hi-IN': 'Hindi', 'bn-IN': 'Bengali', 'gu-IN': 'Gujarati', 'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'pa-IN': 'Punjabi', 'ta-IN': 'Tamil', 'te-IN': 'Telugu' };
const STT_MODELS = ['saarika:v2.5', 'saaras:v3', 'saaras:v3-realtime', 'saarika:v1'];
const V2_SPEAKERS = ['Anushka', 'Manisha', 'Vidya', 'Arya', 'Abhilash', 'Karun', 'Hitesh'];
const V3_SPEAKERS = ['Arvind', 'Amol', 'Amartya', 'Diya', 'Neel', 'Mahi', 'Arya', 'Anushka'];
const DEFAULT_AI: AISettings = {
  companionName: 'Serenity', greeting: "Hi, I'm Serenity. I'm here to listen…",
  systemPrompt: 'You are Serenity, a compassionate mental health companion. Validate feelings first. Keep responses short (1–3 sentences). Never try to "fix" problems. If crisis mentioned, redirect to professionals. Avoid markdown or bullet points — speak naturally.',
  ttsModel: 'bulbul:v2', voice: 'Anushka', language: 'en-IN', sttModel: 'saarika:v2.5',
  pitch: 0, pace: 1.0, loudness: 1.5,
  vadThreshold: 25, silenceTimeout: 1500, minSpeechDuration: 400, maxTokens: 150, temperature: 0.7,
};

function normalizeId<T extends Record<string, unknown>>(obj: T): T & { _id: string } {
  return { ...obj, _id: (obj._id as string) || (obj.id as string) || '' };
}

export function AdminDashboard({ user }: { user: UserInfo }) {
  const router = useRouter();
  const [tab, setTab] = useState<'listeners' | 'therapists' | 'transcripts' | 'ai' | 'reports'>('listeners');
  const [listeners, setListeners] = useState<ListenerRow[]>([]);
  const [therapists, setTherapists] = useState<TherapistRow[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<'' | 'pending' | 'warned' | 'suspended' | 'dismissed'>('');
  const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI);
  const [loading, setLoading] = useState(true);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [stats, setStats] = useState({ totalUsers: 0, totalListeners: 0, onlineListeners: 0, totalCalls: 0, totalMinutes: 0 });

  const [listenerModal, setListenerModal] = useState<{ mode: 'add' | 'edit'; data?: ListenerRow } | null>(null);
  const [therapistModal, setTherapistModal] = useState<{ mode: 'add' | 'edit'; data?: TherapistRow } | null>(null);
  const [analyticsPanel, setAnalyticsPanel] = useState<{ type: 'listener' | 'therapist'; entityId?: string; data: ListenerAnalytics | TherapistAnalytics } | null>(null);

  const [lForm, setLForm] = useState({ name: '', email: '', specialties: '', bio: '', costPerMin: '' });
  const [bulkRate, setBulkRate] = useState('');
  const [showBulkRateModal, setShowBulkRateModal] = useState(false);
  const [commissionPct, setCommissionPct] = useState(0);
  const [bulkCommission, setBulkCommission] = useState('');
  const [therapistCommissionPct, setTherapistCommissionPct] = useState(0);
  const [showTherapistSettingsModal, setShowTherapistSettingsModal] = useState(false);
  const [therapistCommissionInput, setTherapistCommissionInput] = useState('');
  const [tForm, setTForm] = useState({ name: '', email: '', title: '', description: '', credentials: '', experience: '', specialties: '' as string, gender: 'female', rate: '799', photoUrl: '' });
  const SPECIALTIES_OPTIONS = ['Anxiety', 'Depression', 'CBT', 'Trauma & PTSD', 'Relationship Issues', 'Stress Management', 'Grief & Loss', 'OCD', 'Addiction', 'Family Therapy', 'Career Counseling', 'Self-Esteem', 'Sleep Issues', 'Anger Management', 'LGBTQ+ Affirming'];
  const toggleSpecialty = (s: string) => {
    const arr = tForm.specialties ? tForm.specialties.split(',').map(x => x.trim()).filter(Boolean) : [];
    const updated = arr.includes(s) ? arr.filter(x => x !== s) : [...arr, s];
    setTForm(f => ({ ...f, specialties: updated.join(', ') }));
  };
  const [transcriptSessionFilter, setTranscriptSessionFilter] = useState('');
  const [transcriptSpeakerFilter, setTranscriptSpeakerFilter] = useState('');
  const [selectedTranscript, setSelectedTranscript] = useState<TranscriptRow | null>(null);
  const [conversationModal, setConversationModal] = useState<{ sessionId: string; participants: string[]; conversation: ConversationTurn[]; } | null>(null);
  const [conversationLoading, setConversationLoading] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  const token = getToken() || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    const fetchWithAuth = (url: string) =>
      fetch(url, { headers }).then(r => {
        if (r.status === 401) { clearUser(); router.push('/auth/login'); return null; }
        return r.json();
      }).catch(() => null);

    Promise.all([
      fetchWithAuth(`${apiUrl}/api/admin/listeners`),
      fetch(`${apiUrl}/api/therapists`, { headers }).then(r => r.json()).catch(() => null),
      fetchWithAuth(`${apiUrl}/api/admin/transcripts?limit=25`),
      fetch(`${apiUrl}/api/sarvam/settings`, { headers }).then(r => r.json()).catch(() => null),
      fetchWithAuth(`${apiUrl}/api/admin/stats`),
      fetchWithAuth(`${apiUrl}/api/admin/settings`),
      fetchWithAuth(`${apiUrl}/api/admin/reports?limit=50`),
    ]).then(([l, t, tr, ai, s, cfg, rp]) => {
      if (!l && !s) return; // redirected to login
      const rawListeners: ListenerRow[] = (l?.data?.listeners || l?.data || []).map(normalizeId);
      const rawTherapists: TherapistRow[] = (t?.data || []).map(normalizeId);
      const rawTranscripts: TranscriptRow[] = (tr?.data?.transcripts || []).map((item: TranscriptRow) => ({ ...item }));
      setListeners(rawListeners);
      setTherapists(rawTherapists);
      setTranscripts(rawTranscripts);
      if (rp?.data?.reports) setReports(rp.data.reports.map((r: ReportRow) => ({ ...r, _id: r._id || (r as unknown as { id: string }).id || '' })));
      if (ai?.data) setAiSettings(prev => ({ ...prev, ...ai.data }));
      if (s?.data) setStats({ totalUsers: s.data.totalUsers || 0, totalListeners: s.data.totalListeners || 0, onlineListeners: s.data.onlineListeners || 0, totalCalls: s.data.totalCalls || 0, totalMinutes: s.data.totalMinutes || 0 });
      if (cfg?.data) {
        setCommissionPct(cfg.data.commissionPct ?? 0);
        setBulkCommission(String(cfg.data.commissionPct ?? 0));
        setTherapistCommissionPct(cfg.data.therapistCommissionPct ?? 0);
        setTherapistCommissionInput(String(cfg.data.therapistCommissionPct ?? 0));
      }
      setLoading(false);
    });
  }, []);

  const deleteListener = async (id: string) => {
    if (!confirm('Remove this listener? Their account will be deleted.')) return;
    await fetch(`${apiUrl}/api/admin/listeners/${id}`, { method: 'DELETE', headers });
    setListeners(prev => prev.filter(l => l._id !== id));
    showToast('Listener removed');
  };

  const saveListener = async () => {
    if (!lForm.name || !lForm.email) return;
    const isEdit = listenerModal?.mode === 'edit';
    const url = isEdit ? `${apiUrl}/api/admin/listeners/${listenerModal?.data?._id}` : `${apiUrl}/api/admin/listeners`;
    const body = {
      name: lForm.name,
      email: lForm.email,
      bio: lForm.bio,
      specialties: lForm.specialties.split(',').map(s => s.trim()).filter(Boolean),
      costPerMin: parseFloat(lForm.costPerMin) || 0,
    };
    await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) }).catch(() => null);
    // Refetch full list so costPerMin and all fields reflect DB state
    const fresh = await fetch(`${apiUrl}/api/admin/listeners`, { headers }).then(r => r.json()).catch(() => null);
    if (fresh) setListeners((fresh?.data?.listeners || fresh?.data || []).map(normalizeId));
    setListenerModal(null);
    showToast(isEdit ? 'Listener updated' : 'Listener added');
  };

  const deleteTherapist = async (id: string) => {
    if (!confirm('Remove this therapist? Their account will be deleted.')) return;
    await fetch(`${apiUrl}/api/therapists/${id}`, { method: 'DELETE', headers });
    setTherapists(prev => prev.filter(t => t._id !== id));
    showToast('Therapist removed');
  };

  const saveTherapist = async () => {
    if (!tForm.name || !tForm.email || !tForm.title) return;
    const isEdit = therapistModal?.mode === 'edit';
    const url = isEdit ? `${apiUrl}/api/therapists/${therapistModal?.data?._id}` : `${apiUrl}/api/therapists`;
    const body = { ...tForm, specialties: tForm.specialties.split(',').map(s => s.trim()).filter(Boolean), pricePerMin: Number(tForm.rate) || 799 };
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers, body: JSON.stringify(body) }).then(r => r.json()).catch(() => null);
    const saved = res?.data ? normalizeId(res.data) : null;
    if (saved) { setTherapists(prev => isEdit ? prev.map(t => t._id === saved._id ? { ...t, ...saved } as TherapistRow : t) : [...prev, saved as TherapistRow]); }
    setTherapistModal(null);
    showToast(isEdit ? 'Therapist updated' : 'Therapist added');
  };

  const saveAI = async () => {
    await fetch(`${apiUrl}/api/sarvam/settings`, { method: 'POST', headers, body: JSON.stringify(aiSettings) }).catch(() => null);
    showToast('AI settings saved');
  };

  const fetchTranscripts = async () => {
    setTranscriptLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '25');
      if (transcriptSessionFilter.trim()) params.set('sessionId', transcriptSessionFilter.trim());
      if (transcriptSpeakerFilter.trim()) params.set('speaker', transcriptSpeakerFilter.trim());
      const res = await fetch(`${apiUrl}/api/admin/transcripts?${params.toString()}`, { headers }).then(r => r.json()).catch(() => null);
      if (res?.data?.transcripts) setTranscripts(res.data.transcripts);
      showToast('Transcripts refreshed');
    } finally {
      setTranscriptLoading(false);
    }
  };

  const fetchConversation = async (sessionId: string) => {
    setConversationLoading(sessionId);
    try {
      const res = await fetch(`${apiUrl}/api/admin/transcripts/session/${encodeURIComponent(sessionId)}/conversation`, { headers }).then(r => r.json()).catch(() => null);
      if (res?.data) {
        setConversationModal({ sessionId, participants: res.data.participants || [], conversation: res.data.conversation || [] });
      } else {
        showToast('Could not load conversation');
      }
    } finally {
      setConversationLoading(null);
    }
  };

  const fetchReports = async (status?: string) => {
    const qs = status ? `?status=${status}&limit=50` : '?limit=50';
    const r = await fetch(`${apiUrl}/api/admin/reports${qs}`, { headers });
    if (r.status === 401) { clearUser(); router.push('/auth/login'); return; }
    const res = await r.json().catch(() => null);
    if (res?.data?.reports) setReports(res.data.reports.map((r: ReportRow) => ({ ...r, _id: r._id || (r as unknown as { id: string }).id || '' })));
  };

  const updateReportStatus = async (id: string, status: 'pending' | 'warned' | 'dismissed' | 'suspended') => {
    const r = await fetch(`${apiUrl}/api/admin/reports/${id}`, { method: 'PATCH', headers, body: JSON.stringify({ status }) });
    if (r.status === 401) { clearUser(); router.push('/auth/login'); return; }
    setReports(prev => prev.map(r => r._id === id ? { ...r, status } : r));
    showToast(status === 'dismissed' ? 'Report dismissed' : status === 'pending' ? 'Report reopened' : `Report ${status}`);
  };

  const sendWarning = async (id: string) => {
    const resp = await fetch(`${apiUrl}/api/admin/reports/${id}/warn`, { method: 'POST', headers });
    if (resp.status === 401) { clearUser(); router.push('/auth/login'); return; }
    const data = await resp.json().catch(() => null);
    if (!data?.success) { showToast(data?.error || 'Failed to send warning'); return; }
    setReports(prev => prev.map(report => report._id === id ? { ...report, warningSent: true, status: 'warned' } : report));
    showToast('Warning email sent');
  };

  const unsuspendReportedUser = async (id: string) => {
    const r = await fetch(`${apiUrl}/api/admin/reports/${id}/unsuspend`, { method: 'POST', headers });
    if (r.status === 401) { clearUser(); router.push('/auth/login'); return; }
    const res = await r.json().catch(() => null);
    if (!res?.success) { showToast(res?.error || 'Failed to revoke suspension'); return; }
    setReports(prev => prev.map(r => r._id === id ? { ...r, status: 'warned' } : r));
    showToast('Suspension revoked — user can log in again');
  };

  const suspendReportedUser = async (id: string) => {
    if (!confirm('Suspend this user? They will be blocked from logging in immediately.')) return;
    const r = await fetch(`${apiUrl}/api/admin/reports/${id}/suspend`, { method: 'POST', headers });
    if (r.status === 401) { clearUser(); router.push('/auth/login'); return; }
    const res = await r.json().catch(() => null);
    if (!res?.success) { showToast(res?.error || 'Failed to suspend user'); return; }
    setReports(prev => prev.map(r => r._id === id ? { ...r, status: 'suspended' } : r));
    showToast(`User suspended`);
  };

  const exportConversationJSONL = (sessionId: string, conversation: ConversationTurn[]) => {
    const lines = conversation.map(t => JSON.stringify({ speaker: t.speaker, start: t.start, end: t.end, text: t.text }));
    const blob = new Blob([lines.join('\n')], { type: 'application/jsonlines' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation_${sessionId}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const applyBulkRate = async () => {
    const rate = parseFloat(bulkRate);
    if (isNaN(rate) || rate < 0) return;
    const res = await fetch(`${apiUrl}/api/admin/listeners/bulk-rate`, {
      method: 'PATCH', headers, body: JSON.stringify({ costPerMin: rate }),
    }).then(r => r.json()).catch(() => null);
    if (!res?.success) { showToast('Failed to update rates'); return; }
    setListeners(prev => prev.map(l => ({ ...l, costPerMin: rate })));
    setBulkRate('');
    return res;
  };

  const saveTherapistSettings = async () => {
    const pct = parseFloat(therapistCommissionInput);
    if (isNaN(pct) || pct < 0 || pct > 100) return;
    const res = await fetch(`${apiUrl}/api/admin/settings`, {
      method: 'POST', headers, body: JSON.stringify({ therapistCommissionPct: pct }),
    }).then(r => r.json()).catch(() => null);
    if (!res?.success) { showToast('Failed to save settings'); return; }
    setTherapistCommissionPct(pct);
    setShowTherapistSettingsModal(false);
    showToast('Therapist commission updated');
  };

  const saveSettings = async () => {
    const pct = parseFloat(bulkCommission);
    const rate = bulkRate ? parseFloat(bulkRate) : null;

    const promises: Promise<unknown>[] = [];

    if (!isNaN(pct) && pct >= 0 && pct <= 100) {
      promises.push(
        fetch(`${apiUrl}/api/admin/settings`, {
          method: 'POST', headers, body: JSON.stringify({ commissionPct: pct }),
        }).then(r => r.json()).then(res => { if (res?.success) setCommissionPct(pct); })
      );
    }

    if (rate !== null && !isNaN(rate) && rate >= 0) {
      promises.push(applyBulkRate());
    }

    await Promise.all(promises);
    setShowBulkRateModal(false);
    showToast('Settings saved');
  };

  const openListenerAnalytics = async (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${apiUrl}/api/admin/listeners/${id}/analytics${qs}`, { headers }).then(r => r.json()).catch(() => null);
    if (res?.data?.analytics) setAnalyticsPanel({ type: 'listener', entityId: id, data: res.data.analytics });
  };

  const openTherapistAnalytics = async (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('startDate', from.split('T')[0]);
    if (to) params.set('endDate', to.split('T')[0]);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`${apiUrl}/api/therapists/${id}/analytics${qs}`, { headers }).then(r => r.json()).catch(() => null);
    if (res?.data?.analytics) setAnalyticsPanel({ type: 'therapist', entityId: id, data: res.data.analytics });
  };

  const speakerOptions = aiSettings.ttsModel === 'bulbul:v2' ? V2_SPEAKERS : V3_SPEAKERS;
  const signOut = () => { clearUser(); router.push('/auth/login'); };

  const totalListeners = stats.totalListeners || listeners.length;
  const onlineListeners = stats.onlineListeners;
  const totalTherapists = therapists.length;
  // Platform-wide totals — stats API aggregates directly from callLogs (always accurate)
  const totalCalls = stats.totalCalls || listeners.reduce((s, l) => s + (l.totalCalls || 0), 0);
  // Use stats.totalMinutes (callLogs aggregate) for platform hours; fall back to per-listener sum
  const totalCallMinutes = stats.totalMinutes || listeners.reduce((s, l) => s + (l.totalMinutes || 0), 0);
  const totalCallHours = parseFloat((totalCallMinutes / 60).toFixed(1));
  // Revenue = per-listener (minutes × rate); listeners data now comes from callLogs aggregate too
  const estimatedRevenue = listeners.reduce((s, l) => s + ((l.totalMinutes || 0) * (l.costPerMin || 0)), 0);
  const platformEarnings = parseFloat((estimatedRevenue * commissionPct / 100).toFixed(2));
  const ratedListeners = listeners.filter(l => (l.rating || 0) > 0);
  const avgListenerRating = ratedListeners.length
    ? parseFloat((ratedListeners.reduce((s, l) => s + l.rating, 0) / ratedListeners.length).toFixed(1))
    : 0;
  const topListeners = [...listeners].sort((a, b) => (b.totalCalls || 0) - (a.totalCalls || 0)).slice(0, 5);
  const maxTopCalls = topListeners[0]?.totalCalls || 1;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <DashboardNav name={user.name} onSignOut={signOut} />

      {toast && (
        <div style={{ position: 'fixed', top: 76, left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: '#FBF8F0', padding: '10px 20px', borderRadius: 12, fontSize: 14, fontWeight: 500, zIndex: 400, animation: 'fadeUp 0.3s ease' }}>{toast}</div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Stats bar — 6 KPI cards */}
        <div className="g6" style={{ marginBottom: 24 }}>
          {([
            { label: 'Registered Users', value: stats.totalUsers, sub: 'clients', color: 'rgba(100,140,180,0.12)', Icon: UsersIcon },
            { label: 'Total Listeners', value: totalListeners, sub: `${onlineListeners} online now`, color: 'var(--sage-soft)', Icon: HeadphoneIcon },
            { label: 'Total Therapists', value: totalTherapists, sub: 'licensed', color: 'rgba(130,100,180,0.12)', Icon: TherapistIcon },
            { label: 'Total Calls', value: totalCalls, sub: 'all time', color: 'rgba(100,160,200,0.12)', Icon: CallIcon },
            { label: 'Call Hours', value: totalCallHours, sub: `${totalCallMinutes.toLocaleString('en-IN')} min total`, color: 'rgba(200,160,80,0.10)', Icon: ClockIcon },
            { label: 'Avg Listener Rating', value: avgListenerRating > 0 ? avgListenerRating.toFixed(1) : '—', sub: `${ratedListeners.length} rated`, color: 'rgba(220,140,80,0.10)', Icon: StarIcon },
          ] as { label: string; value: string | number; sub: string; color: string; Icon: () => React.ReactElement }[]).map((s, i) => (
            <KpiCard key={i} label={s.label} value={s.value} sub={s.sub} color={s.color} Icon={s.Icon} delay={i * 0.05} loading={loading} />
          ))}
        </div>

        {/* Platform insights strip */}
        {!loading && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28, animation: 'fadeUp 0.4s ease 0.25s both' }}>
            {/* Revenue breakdown */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '22px 24px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--muted)', fontWeight: 600, marginBottom: 16 }}>Revenue Overview</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="serif" style={{ fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                    ₹{estimatedRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Gross Revenue</div>
                </div>
                <div style={{ background: 'var(--sage-soft)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="serif" style={{ fontSize: 22, fontWeight: 400, color: 'var(--sage)' }}>
                    ₹{platformEarnings.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--sage)', marginTop: 3, opacity: 0.8 }}>Platform ({commissionPct}%)</div>
                </div>
                <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px' }}>
                  <div className="serif" style={{ fontSize: 22, fontWeight: 400, color: 'var(--ink)' }}>
                    ₹{Math.max(0, estimatedRevenue - platformEarnings).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Listeners earn</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                <span>{totalCallHours} hrs · {totalCallMinutes.toLocaleString('en-IN')} min billed</span>
                <span style={{ color: 'var(--line)' }}>·</span>
                <span>{totalCalls} total calls</span>
              </div>
            </div>

            {/* Top listeners by calls */}
            <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '22px 24px' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.1, color: 'var(--muted)', fontWeight: 600, marginBottom: 16 }}>Top Listeners by Calls</div>
              {topListeners.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)', paddingTop: 8 }}>No listener call data yet</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topListeners.map((l, i) => {
                    const pct = Math.max(4, Math.round(((l.totalCalls || 0) / maxTopCalls) * 100));
                    return (
                      <div key={l._id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)', width: 16, textAlign: 'right' }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8, flexShrink: 0 }}>{l.totalCalls} calls · {l.totalMinutes ? `${(l.totalMinutes / 60).toFixed(1)}h` : '0h'}</span>
                          </div>
                          <div style={{ height: 5, borderRadius: 999, background: 'var(--bg-2)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, borderRadius: 999, background: i === 0 ? 'var(--sage)' : 'var(--sage-soft)', transition: 'width 0.6s ease' }} />
                          </div>
                        </div>
                        {l.isAvailable && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sage)', flexShrink: 0 }} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab nav */}
        <div className="tabs-row" style={{ marginBottom: 28 }}>
          {([['listeners', HeadphoneIcon, 'Listeners'], ['therapists', TherapistIcon, 'Therapists'], ['transcripts', TranscriptIcon, 'Transcripts'], ['ai', AIIcon, 'AI Companion'], ['reports', ReportIcon, `Reports${reports.filter(r => r.status === 'pending').length ? ` (${reports.filter(r => r.status === 'pending').length})` : ''}`]] as [string, () => React.ReactElement, string][]).map(([key, Icon, label]) => (
            <button key={key} onClick={() => setTab(key as typeof tab)} style={{
              padding: '9px 20px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: tab === key ? 'var(--sage)' : 'var(--card)',
              color: tab === key ? '#FBF8F0' : 'var(--muted)',
              outline: tab === key ? 'none' : '1px solid var(--line)',
              fontSize: 13, fontWeight: 500, transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: 7,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              <span style={{ opacity: 0.85 }}><Icon /></span> {label}
            </button>
          ))}
        </div>

        {/* Transcripts tab */}
        {tab === 'transcripts' && (
          <div style={{ animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>Call Transcripts</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>Admin-only view of saved Whisper transcripts</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, minWidth: 220, maxWidth: 260 }}
                  placeholder="Filter by session ID"
                  value={transcriptSessionFilter}
                  onChange={(e) => setTranscriptSessionFilter(e.target.value)}
                />
                <select
                  style={{ ...inputStyle, minWidth: 160 }}
                  value={transcriptSpeakerFilter}
                  onChange={(e) => setTranscriptSpeakerFilter(e.target.value)}
                >
                  <option value="">All speakers</option>
                  <option value="client">Client</option>
                  <option value="listener">Listener</option>
                  <option value="unknown">Unknown</option>
                </select>
                <button onClick={fetchTranscripts} style={addBtnStyle} disabled={transcriptLoading}>
                  {transcriptLoading ? 'Refreshing…' : 'Refresh'}
                </button>
              </div>
            </div>

            {loading ? <LoadingRows /> : transcripts.length === 0 ? (
              <EmptyState icon={<TranscriptIcon />} title="No transcripts yet" sub="Saved call transcripts will appear here" />
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Session', 'Speaker', 'Processor', 'Confidence', 'Preview', 'Created', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transcripts.map((item, index) => (
                      <tr key={item.id} style={{ borderTop: index > 0 ? '1px solid var(--line-2)' : 'none', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={{ fontWeight: 500, fontSize: 13 }}>{item.sessionId}</span>
                            {item.callId && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.callId}</span>}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 10px', borderRadius: 999, background: item.speaker === 'client' ? 'rgba(100,140,180,0.12)' : item.speaker === 'listener' ? 'var(--sage-soft)' : 'var(--bg-2)', color: 'var(--ink-2)', fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>
                            {item.speaker}
                          </span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{item.processor}</span>
                            {item.model && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{item.model}</span>}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{item.confidence ? `${Math.round(item.confidence * 100)}%` : '—'}</td>
                        <td style={{ ...tdStyle, maxWidth: 320 }}>
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {item.text || 'No transcript text'}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(item.createdAt).toLocaleString()}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <TblBtn label="View" accent onClick={() => setSelectedTranscript(item)} />
                            <TblBtn label={conversationLoading === item.sessionId ? '…' : 'Convo'} onClick={() => fetchConversation(item.sessionId)} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Listeners tab */}
        {tab === 'listeners' && (
          <div style={{ animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>Peer Listeners</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>Manage listener accounts and view their performance analytics</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setBulkRate(''); setShowBulkRateModal(true); }} title="Set price for all listeners" style={{
                  width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line)',
                  background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                </button>
                <button onClick={() => { setLForm({ name: '', email: '', specialties: '', bio: '', costPerMin: '' }); setListenerModal({ mode: 'add' }); }} style={addBtnStyle}>
                  + Add Listener
                </button>
              </div>
            </div>
            {loading ? <LoadingRows /> : listeners.length === 0 ? (
              <EmptyState icon={<HeadphoneIcon />} title="No listeners yet" sub="Add your first peer listener to get started" />
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Listener', 'Specialties', 'Status', 'Calls', 'Hrs', 'Rate', 'Rating', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {listeners.map((l, i) => {
                      const specs = Array.isArray(l.specialties) ? l.specialties : (l.specialties ? String(l.specialties).split(',') : []);
                      const hrs = l.totalMinutes ? (l.totalMinutes / 60).toFixed(1) : '—';
                      return (
                        <tr key={l._id} style={{ borderTop: i > 0 ? '1px solid var(--line-2)' : 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={l.name} tone="lavender" size={34} />
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{l.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{l.email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, maxWidth: 160 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {specs.slice(0, 2).map(s => <span key={s} style={tagStyle}>{s.trim()}</span>)}
                              {specs.length > 2 && <span style={tagStyle}>+{specs.length - 2}</span>}
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ padding: '3px 10px', borderRadius: 999, background: l.isAvailable ? 'var(--sage-soft)' : 'var(--bg-2)', color: l.isAvailable ? 'var(--sage)' : 'var(--muted)', fontSize: 11, fontWeight: 600 }}>
                              {l.isAvailable ? '● Online' : '○ Offline'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{l.totalCalls ?? '—'}</td>
                          <td style={{ ...tdStyle, color: 'var(--muted)' }}>{hrs}</td>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>{l.costPerMin ? `₹${l.costPerMin}/min` : <span style={{ color: 'var(--muted)' }}>Free</span>}</td>
                          <td style={tdStyle}>{l.rating ? <StarRating value={l.rating} /> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <TblBtn label="Analytics" accent onClick={() => openListenerAnalytics(l._id)} />
                              <TblBtn label="Edit" onClick={() => { setLForm({ name: l.name, email: l.email, specialties: Array.isArray(l.specialties) ? l.specialties.join(', ') : (l.specialties || ''), bio: l.bio || '', costPerMin: l.costPerMin != null ? String(l.costPerMin) : '' }); setListenerModal({ mode: 'edit', data: l }); }} />
                              <TblBtn label="Remove" danger onClick={() => deleteListener(l._id)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Therapists tab */}
        {tab === 'therapists' && (
          <div style={{ animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div>
                <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>Licensed Therapists</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>Manage therapist profiles and view appointment analytics</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setTherapistCommissionInput(String(therapistCommissionPct)); setShowTherapistSettingsModal(true); }} title="Therapist commission settings" style={{
                  width: 40, height: 40, borderRadius: 10, border: '1px solid var(--line)',
                  background: 'var(--card)', color: 'var(--muted)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s',
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
                  </svg>
                </button>
                <button onClick={() => { setTForm({ name: '', email: '', title: '', description: '', credentials: '', experience: '', specialties: '', gender: 'female', rate: '799', photoUrl: '' }); setTherapistModal({ mode: 'add' }); }} style={addBtnStyle}>
                  + Add Therapist
                </button>
              </div>
            </div>
            {loading ? <LoadingRows /> : therapists.length === 0 ? (
              <EmptyState icon={<TherapistIcon />} title="No therapists yet" sub="Add your first licensed therapist to get started" />
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Therapist', 'Specialties', 'Rate', 'Experience', 'Rating', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {therapists.map((t, i) => {
                      const specs = Array.isArray(t.specialties) ? t.specialties : (t.specialties ? String(t.specialties).split(',') : []);
                      return (
                        <tr key={t._id} style={{ borderTop: i > 0 ? '1px solid var(--line-2)' : 'none', transition: 'background 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <Avatar name={t.name} tone="peach" size={34} />
                              <div>
                                <div style={{ fontWeight: 500, fontSize: 14 }}>{t.name}</div>
                                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.title}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ ...tdStyle, maxWidth: 160 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {specs.slice(0, 2).map(s => <span key={s} style={{ ...tagStyle, background: 'rgba(130,100,180,0.1)', color: 'var(--ink-2)' }}>{s.trim()}</span>)}
                              {specs.length > 2 && <span style={{ ...tagStyle, background: 'rgba(130,100,180,0.1)', color: 'var(--ink-2)' }}>+{specs.length - 2}</span>}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, fontWeight: 500 }}>₹{t.rate || 799}/hr</td>
                          <td style={{ ...tdStyle, color: 'var(--muted)', fontSize: 13 }}>{t.experience || '—'}</td>
                          <td style={tdStyle}>{t.rating ? <StarRating value={t.rating} /> : <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                          <td style={tdStyle}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <TblBtn label="Analytics" accent onClick={() => openTherapistAnalytics(t._id)} />
                              <TblBtn label="Edit" onClick={() => { setTForm({ name: t.name, email: t.email, title: t.title || '', description: t.description || '', credentials: t.credentials || '', experience: t.experience || '', specialties: Array.isArray(t.specialties) ? t.specialties.join(', ') : (t.specialties || ''), gender: t.gender || 'female', rate: String(t.rate || 799), photoUrl: (t as TherapistRow & { photoUrl?: string }).photoUrl || '' }); setTherapistModal({ mode: 'edit', data: t }); }} />
                              <TblBtn label="Remove" danger onClick={() => deleteTherapist(t._id)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Reports tab */}
        {tab === 'reports' && (
          <div style={{ animation: 'fadeUp 0.3s ease both' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
              <div>
                <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>User Reports</h2>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>Reports submitted during peer and listener calls</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {([
                  { key: '', label: 'All', dot: '' },
                  { key: 'pending', label: 'Pending', dot: 'var(--alert)' },
                  { key: 'warned', label: 'Warned', dot: '#B07A0A' },
                  { key: 'suspended', label: 'Suspended', dot: '#7C1D1D' },
                  { key: 'dismissed', label: 'Dismissed', dot: 'var(--muted)' },
                ] as { key: string; label: string; dot: string }[]).map(({ key, label, dot }) => {
                  const count = key ? reports.filter(r => r.status === key).length : 0;
                  return (
                    <button key={key} onClick={() => { setReportStatusFilter(key as typeof reportStatusFilter); fetchReports(key || undefined); }} style={{
                      padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                      background: reportStatusFilter === key ? 'var(--sage)' : 'var(--card)',
                      color: reportStatusFilter === key ? '#FBF8F0' : 'var(--muted)',
                      outline: reportStatusFilter === key ? 'none' : '1px solid var(--line)',
                      transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: reportStatusFilter === key ? '#FBF8F0' : dot, flexShrink: 0 }} />}
                      {label}
                      {count > 0 && (
                        <span style={{ background: reportStatusFilter === key ? 'rgba(255,255,255,0.3)' : 'var(--alert)', color: '#fff', borderRadius: 999, padding: '1px 6px', fontSize: 10, marginLeft: 2 }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? <LoadingRows /> : reports.length === 0 ? (
              <EmptyState icon={<ReportIcon />} title="No reports yet" sub="Reports submitted during calls will appear here" />
            ) : (
              <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--line)' }}>
                      {['Reporter', 'Reported User', 'Reason', 'Details', 'Session', 'Status', 'Date', 'Actions'].map(h => (
                        <th key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reportStatusFilter ? reports.filter(r => r.status === reportStatusFilter) : reports).map((item, index) => (
                      <tr key={item._id} style={{ borderTop: index > 0 ? '1px solid var(--line-2)' : 'none', transition: 'background 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <td style={tdStyle}>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{item.reporterName}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.reporterEmail}</div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 500 }}>{item.reportedUser}</td>
                        <td style={tdStyle}>
                          <span style={{ padding: '4px 10px', borderRadius: 8, background: 'rgba(178,107,92,0.1)', color: 'var(--alert)', fontSize: 12, fontWeight: 500 }}>
                            {item.reason}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 220, fontSize: 13, color: 'var(--ink-2)' }}>
                          {item.details ? (
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {item.details}
                            </div>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {item.sessionId ? (
                            <code style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--bg-2)', padding: '2px 6px', borderRadius: 4 }}>
                              {item.sessionId.slice(0, 10)}…
                            </code>
                          ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                        </td>
                        <td style={tdStyle}>
                          {(() => {
                            const cfg: Record<string, { bg: string; color: string; label: string }> = {
                              pending:   { bg: 'rgba(178,107,92,0.1)',    color: 'var(--alert)', label: 'Pending' },
                              warned:    { bg: 'rgba(245,166,35,0.12)',   color: '#B07A0A',      label: 'Warned' },
                              suspended: { bg: 'rgba(124,29,29,0.1)',     color: '#7C1D1D',      label: 'Suspended' },
                              dismissed: { bg: 'var(--bg-2)',             color: 'var(--muted)', label: 'Dismissed' },
                            };
                            const s = cfg[item.status] || cfg.dismissed;
                            return (
                              <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
                                {s.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {item.status !== 'suspended' && item.status !== 'dismissed' && (
                              item.warningSent ? (
                                <span style={{ padding: '4px 9px', borderRadius: 8, background: 'rgba(245,166,35,0.12)', color: '#B07A0A', fontSize: 11, fontWeight: 600, border: '1px solid rgba(245,166,35,0.25)', whiteSpace: 'nowrap' }}>
                                  ✓ Warned
                                </span>
                              ) : (
                                <TblBtn label="Warn" onClick={() => sendWarning(item._id)} />
                              )
                            )}
                            {item.status !== 'dismissed' && item.status !== 'suspended' && (
                              <TblBtn label="Dismiss" onClick={() => updateReportStatus(item._id, 'dismissed')} />
                            )}
                            {item.status === 'dismissed' && (
                              <TblBtn label="Reopen" accent onClick={() => updateReportStatus(item._id, 'pending')} />
                            )}
                            {item.status === 'suspended' && (
                              <button
                                onClick={() => unsuspendReportedUser(item._id)}
                                style={{
                                  padding: '5px 12px', borderRadius: 8, border: '1px solid rgba(124,29,29,0.3)',
                                  background: 'rgba(124,29,29,0.06)', color: '#7C1D1D',
                                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,29,29,0.12)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(124,29,29,0.06)')}
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                                </svg>
                                Revoke Suspension
                              </button>
                            )}
                            {item.status !== 'suspended' && (
                              <ReportGearMenu onSuspend={() => suspendReportedUser(item._id)} />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* AI tab */}
        {tab === 'ai' && (
          <div style={{ animation: 'fadeUp 0.3s ease both', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <FormCard title="Identity">
              <Field label="Companion Name"><input style={inputStyle} value={aiSettings.companionName} onChange={e => setAiSettings(s => ({ ...s, companionName: e.target.value }))} /></Field>
              <Field label="Opening Greeting"><textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Newsreader, serif' }} rows={3} value={aiSettings.greeting} onChange={e => setAiSettings(s => ({ ...s, greeting: e.target.value }))} /></Field>
            </FormCard>
            <FormCard title="Voice Settings">
              <Field label="TTS Model"><select style={inputStyle} value={aiSettings.ttsModel} onChange={e => setAiSettings(s => ({ ...s, ttsModel: e.target.value, voice: V2_SPEAKERS[0] }))}>{TTS_MODELS.map(m => <option key={m}>{m}</option>)}</select></Field>
              <Field label="Speaker / Voice"><select style={inputStyle} value={aiSettings.voice} onChange={e => setAiSettings(s => ({ ...s, voice: e.target.value }))}>{speakerOptions.map(v => <option key={v}>{v}</option>)}</select></Field>
              <Field label="Language"><select style={inputStyle} value={aiSettings.language} onChange={e => setAiSettings(s => ({ ...s, language: e.target.value }))}>{LANGUAGES.map(l => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}</select></Field>
              <Field label="STT Model"><select style={inputStyle} value={aiSettings.sttModel} onChange={e => setAiSettings(s => ({ ...s, sttModel: e.target.value }))}>{STT_MODELS.map(m => <option key={m}>{m}</option>)}</select></Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label={`Pitch (${aiSettings.pitch})`}><input type="range" min={-5} max={5} step={1} value={aiSettings.pitch} onChange={e => setAiSettings(s => ({ ...s, pitch: +e.target.value }))} style={{ width: '100%' }} /></Field>
                <Field label={`Pace (${aiSettings.pace})`}><input type="range" min={0.5} max={2} step={0.1} value={aiSettings.pace} onChange={e => setAiSettings(s => ({ ...s, pace: +e.target.value }))} style={{ width: '100%' }} /></Field>
                <Field label={`Loudness (${aiSettings.loudness})`}><input type="range" min={0.5} max={3} step={0.1} value={aiSettings.loudness} onChange={e => setAiSettings(s => ({ ...s, loudness: +e.target.value }))} style={{ width: '100%' }} /></Field>
              </div>
            </FormCard>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormCard title="System Prompt">
                <Field label="Instructions sent to the AI before every conversation">
                  <textarea style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Newsreader, Georgia, serif', lineHeight: 1.6 }} rows={6} value={aiSettings.systemPrompt} onChange={e => setAiSettings(s => ({ ...s, systemPrompt: e.target.value }))} />
                </Field>
              </FormCard>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormCard title="Behavior Settings">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
                  <Field label={`VAD (${aiSettings.vadThreshold})`}><input type="range" min={5} max={50} value={aiSettings.vadThreshold} onChange={e => setAiSettings(s => ({ ...s, vadThreshold: +e.target.value }))} style={{ width: '100%' }} /></Field>
                  <Field label={`Silence (${aiSettings.silenceTimeout}ms)`}><input type="range" min={500} max={3000} step={100} value={aiSettings.silenceTimeout} onChange={e => setAiSettings(s => ({ ...s, silenceTimeout: +e.target.value }))} style={{ width: '100%' }} /></Field>
                  <Field label={`Min Speech (${aiSettings.minSpeechDuration}ms)`}><input type="range" min={100} max={1000} step={50} value={aiSettings.minSpeechDuration} onChange={e => setAiSettings(s => ({ ...s, minSpeechDuration: +e.target.value }))} style={{ width: '100%' }} /></Field>
                  <Field label={`Max Tokens (${aiSettings.maxTokens})`}><input type="range" min={30} max={500} step={10} value={aiSettings.maxTokens} onChange={e => setAiSettings(s => ({ ...s, maxTokens: +e.target.value }))} style={{ width: '100%' }} /></Field>
                  <Field label={`Temp (${aiSettings.temperature})`}><input type="range" min={0} max={1} step={0.05} value={aiSettings.temperature} onChange={e => setAiSettings(s => ({ ...s, temperature: +e.target.value }))} style={{ width: '100%' }} /></Field>
                </div>
              </FormCard>
            </div>
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={saveAI} style={savePrimaryBtnStyle}>Save AI Settings</button>
            </div>
          </div>
        )}
      </div>

      {/* Listener form modal */}
      {listenerModal && (
        <Modal title={listenerModal.mode === 'add' ? 'Add Peer Listener' : 'Edit Listener'} onClose={() => setListenerModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Full Name *"><input style={inputStyle} value={lForm.name} onChange={e => setLForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></Field>
            <Field label="Cost per Minute (₹)"><input type="text" inputMode="numeric" pattern="[0-9]*" style={inputStyle} value={lForm.costPerMin} onChange={e => setLForm(f => ({ ...f, costPerMin: e.target.value }))} placeholder="e.g. 5" /></Field>
          </div>
          <Field label="Email Address *"><input type="email" style={inputStyle} value={lForm.email} onChange={e => setLForm(f => ({ ...f, email: e.target.value }))} placeholder="listener@email.com" disabled={listenerModal.mode === 'edit'} /></Field>
          <Field label="Specialties"><input style={inputStyle} value={lForm.specialties} onChange={e => setLForm(f => ({ ...f, specialties: e.target.value }))} placeholder="Anxiety, Stress, Relationships (comma-separated)" /></Field>
          <Field label="Bio / Description"><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={lForm.bio} onChange={e => setLForm(f => ({ ...f, bio: e.target.value }))} placeholder="Brief background…" /></Field>
          <ModalActions onCancel={() => setListenerModal(null)} onSave={saveListener} disabled={!lForm.name || !lForm.email} label={listenerModal.mode === 'add' ? 'Add Listener' : 'Save Changes'} />
        </Modal>
      )}

      {/* Therapist form modal */}
      {therapistModal && (
        <Modal title={therapistModal.mode === 'add' ? 'Add Licensed Therapist' : 'Edit Therapist'} onClose={() => setTherapistModal(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Full Name *"><input style={inputStyle} value={tForm.name} onChange={e => setTForm(f => ({ ...f, name: e.target.value }))} placeholder="Dr. Anjali Mehra" /></Field>
            <Field label="Title / Role *"><input style={inputStyle} value={tForm.title} onChange={e => setTForm(f => ({ ...f, title: e.target.value }))} placeholder="Clinical Psychologist" /></Field>
            <Field label="Email Address *"><input type="email" style={inputStyle} value={tForm.email} onChange={e => setTForm(f => ({ ...f, email: e.target.value }))} placeholder="dr@email.com" disabled={therapistModal.mode === 'edit'} /></Field>
            <Field label="Experience"><input style={inputStyle} value={tForm.experience} onChange={e => setTForm(f => ({ ...f, experience: e.target.value }))} placeholder="5 years" /></Field>
            <Field label="Credentials"><input style={inputStyle} value={tForm.credentials} onChange={e => setTForm(f => ({ ...f, credentials: e.target.value }))} placeholder="M.Phil, RCI Licensed" /></Field>
            <Field label="Rate (₹/hr)"><input type="number" style={inputStyle} value={tForm.rate} onChange={e => setTForm(f => ({ ...f, rate: e.target.value }))} placeholder="799" /></Field>
          </div>
          <Field label="Profile Photo URL">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input style={{ ...inputStyle, flex: 1 }} value={tForm.photoUrl} onChange={e => setTForm(f => ({ ...f, photoUrl: e.target.value }))} placeholder="https://example.com/photo.jpg" />
              {tForm.photoUrl && <img src={tForm.photoUrl} alt="preview" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--sage-soft)', flexShrink: 0 }} />}
            </div>
          </Field>
          <Field label="Specialties">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 0' }}>
              {SPECIALTIES_OPTIONS.map(s => {
                const selected = tForm.specialties.split(',').map(x => x.trim()).includes(s);
                return (
                  <button key={s} type="button" onClick={() => toggleSpecialty(s)} style={{ padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: selected ? 'var(--sage)' : 'var(--bg)', color: selected ? '#fff' : 'var(--muted)', outline: `1px solid ${selected ? 'var(--sage)' : 'var(--line)'}`, transition: 'all 0.15s' }}>
                    {s}
                  </button>
                );
              })}
            </div>
            {tForm.specialties && <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>Selected: {tForm.specialties}</p>}
          </Field>
          <Field label="Description"><textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={tForm.description} onChange={e => setTForm(f => ({ ...f, description: e.target.value }))} placeholder="About the therapist…" /></Field>
          <Field label="Gender">
            <div style={{ display: 'flex', gap: 10 }}>
              {[['female', 'Female'], ['male', 'Male']].map(([val, label]) => (
                <button key={val} onClick={() => setTForm(f => ({ ...f, gender: val }))} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: tForm.gender === val ? 'var(--sage-soft)' : 'var(--bg)', outline: `1px solid ${tForm.gender === val ? 'var(--sage)' : 'var(--line)'}`, color: tForm.gender === val ? 'var(--sage)' : 'var(--muted)', fontWeight: 500 }}>{label}</button>
              ))}
            </div>
          </Field>
          <ModalActions onCancel={() => setTherapistModal(null)} onSave={saveTherapist} disabled={!tForm.name || !tForm.email || !tForm.title} label={therapistModal.mode === 'add' ? 'Add Therapist' : 'Save Changes'} />
        </Modal>
      )}

      {/* Therapist settings modal */}
      {showTherapistSettingsModal && (
        <Modal title="Therapist Settings" onClose={() => setShowTherapistSettingsModal(false)}>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0, lineHeight: 1.6 }}>
            Platform commission on therapist session earnings. Each therapist sets their own session rate — only the cut percentage is managed here.
          </p>
          <Field label="Platform commission (%)">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                placeholder={`Current: ${therapistCommissionPct}%`}
                value={therapistCommissionInput}
                autoFocus
                onChange={e => setTherapistCommissionInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveTherapistSettings()}
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 14, fontSize: 13, color: 'var(--muted)', pointerEvents: 'none' }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Platform keeps this % of each therapist&apos;s session earnings</div>
          </Field>
          {therapistCommissionInput && !isNaN(parseFloat(therapistCommissionInput)) && (
            <div style={{ background: 'rgba(130,100,180,0.08)', borderRadius: 12, padding: '12px 16px', fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              Example: ₹799 session → platform keeps <strong>₹{(799 * parseFloat(therapistCommissionInput) / 100).toFixed(0)}</strong>, therapist earns <strong>₹{(799 * (1 - parseFloat(therapistCommissionInput) / 100)).toFixed(0)}</strong>
            </div>
          )}
          <ModalActions
            onCancel={() => setShowTherapistSettingsModal(false)}
            onSave={saveTherapistSettings}
            disabled={!therapistCommissionInput || isNaN(parseFloat(therapistCommissionInput)) || parseFloat(therapistCommissionInput) < 0 || parseFloat(therapistCommissionInput) > 100}
            label="Save Commission"
          />
        </Modal>
      )}

      {/* Listener settings modal */}
      {showBulkRateModal && (
        <Modal title="Listener Settings" onClose={() => setShowBulkRateModal(false)}>
          {/* Rate */}
          <Field label="Set rate for all listeners (₹/min)">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 14, fontSize: 14, color: 'var(--muted)', pointerEvents: 'none' }}>₹</span>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                placeholder={`Current: varies per listener`}
                value={bulkRate}
                autoFocus
                onChange={e => setBulkRate(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 30, paddingRight: 52 }}
              />
              <span style={{ position: 'absolute', right: 14, fontSize: 13, color: 'var(--muted)', pointerEvents: 'none' }}>/min</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Leave blank to keep existing individual rates</div>
          </Field>

          {/* Commission */}
          <Field label="Platform commission (%)">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*"
                placeholder={`Current: ${commissionPct}%`}
                value={bulkCommission}
                onChange={e => setBulkCommission(e.target.value)}
                style={{ ...inputStyle, paddingRight: 36 }}
              />
              <span style={{ position: 'absolute', right: 14, fontSize: 13, color: 'var(--muted)', pointerEvents: 'none' }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>Platform keeps this % of each listener&apos;s earnings</div>
          </Field>

          {/* Preview */}
          {(() => {
            const rate = parseFloat(bulkRate);
            const pct = parseFloat(bulkCommission);
            const hasRate = bulkRate && !isNaN(rate) && rate >= 0;
            const hasPct = bulkCommission && !isNaN(pct) && pct >= 0 && pct <= 100;
            if (!hasRate && !hasPct) return null;
            const previewRate = hasRate ? rate : null;
            const previewPct = hasPct ? pct : commissionPct;
            return (
              <div style={{ background: 'var(--sage-soft)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {previewRate !== null && (
                  <div style={{ fontSize: 13, color: 'var(--sage)', fontWeight: 500 }}>
                    Rate: ₹{previewRate}/min → will apply to all {listeners.length} listener{listeners.length !== 1 ? 's' : ''}
                  </div>
                )}
                {hasPct && previewRate !== null && (
                  <>
                    <div style={{ borderTop: '1px solid var(--line)', margin: '4px 0' }} />
                    <div style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                      Per minute: ₹{previewRate} → platform keeps ₹{(previewRate * previewPct / 100).toFixed(2)}, listener earns ₹{(previewRate * (1 - previewPct / 100)).toFixed(2)}
                    </div>
                  </>
                )}
                {hasPct && previewRate === null && (
                  <div style={{ fontSize: 13, color: 'var(--sage)', fontWeight: 500 }}>
                    Commission: {previewPct}% platform cut on all listener earnings
                  </div>
                )}
              </div>
            );
          })()}

          <ModalActions
            onCancel={() => setShowBulkRateModal(false)}
            onSave={saveSettings}
            disabled={
              (!bulkRate || isNaN(parseFloat(bulkRate)) || parseFloat(bulkRate) < 0) &&
              (!bulkCommission || isNaN(parseFloat(bulkCommission)) || parseFloat(bulkCommission) < 0 || parseFloat(bulkCommission) > 100)
            }
            label="Save Settings"
          />
        </Modal>
      )}

      {selectedTranscript && (
        <Modal title={`Transcript • ${selectedTranscript.sessionId}`} onClose={() => setSelectedTranscript(null)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Speaker"><div style={{ fontSize: 14, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedTranscript.speaker || 'unknown'}</div></Field>
            <Field label="Confidence"><div style={{ fontSize: 14, color: 'var(--ink)' }}>{selectedTranscript.confidence ? `${Math.round(selectedTranscript.confidence * 100)}%` : '—'}</div></Field>
            <Field label="Processor"><div style={{ fontSize: 14, color: 'var(--ink)' }}>{selectedTranscript.processor || 'whisper'}</div></Field>
            <Field label="Model"><div style={{ fontSize: 14, color: 'var(--ink)' }}>{selectedTranscript.model || '—'}</div></Field>
          </div>
          <Field label="Call ID"><div style={{ fontSize: 13, color: 'var(--muted)', wordBreak: 'break-all' }}>{selectedTranscript.callId || '—'}</div></Field>
          <Field label="Created At"><div style={{ fontSize: 13, color: 'var(--muted)' }}>{new Date(selectedTranscript.createdAt).toLocaleString()}</div></Field>
          <Field label="Full Transcript">
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: 14, color: 'var(--ink)', background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 12, padding: 14, maxHeight: 280, overflowY: 'auto' }}>
              {selectedTranscript.text || 'No transcript text'}
            </div>
          </Field>
          {selectedTranscript.audioPath && (
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <a
                href={`${apiUrl}${selectedTranscript.audioPath.startsWith('/') ? '' : '/'}${selectedTranscript.audioPath}`}
                target="_blank"
                rel="noreferrer"
                style={{ ...saveBtnStyle, textAlign: 'center', textDecoration: 'none', padding: '10px 14px', flex: 'unset' }}
              >
                Download Audio Artifact
              </a>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={() => setSelectedTranscript(null)} style={{ ...cancelBtnStyle, flex: 'unset', minWidth: 120 }}>Close</button>
          </div>
        </Modal>
      )}

      {conversationModal && (() => {
        const fmtTime = (s: number | null) => {
          if (s === null || s === undefined) return '';
          const m = Math.floor(s / 60);
          const sec = Math.floor(s % 60);
          return `${m}:${sec.toString().padStart(2, '0')}`;
        };
        const isClient = (sp: string) => sp === 'client';
        return (
          <Modal title={`Conversation • ${conversationModal.sessionId}`} onClose={() => setConversationModal(null)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                {conversationModal.participants.map(p => (
                  <span key={p} style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600, textTransform: 'capitalize', background: isClient(p) ? 'rgba(100,140,180,0.15)' : 'var(--sage-soft)', color: 'var(--ink-2)' }}>{p}</span>
                ))}
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{conversationModal.conversation.length} segments</span>
            </div>

            {conversationModal.conversation.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>No segments found for this session</div>
            ) : (
              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 2px' }}>
                {conversationModal.conversation.map((turn, i) => {
                  const client = isClient(turn.speaker);
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: client ? 'flex-start' : 'flex-end' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, textTransform: 'capitalize' }}>
                        {turn.speaker}{turn.start !== null ? ` · ${fmtTime(turn.start)}–${fmtTime(turn.end)}` : ''}
                      </span>
                      <div style={{
                        maxWidth: '75%', padding: '10px 14px', borderRadius: client ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                        background: client ? 'rgba(100,140,180,0.12)' : 'var(--sage-soft)',
                        fontSize: 14, lineHeight: 1.55, color: 'var(--ink)',
                      }}>
                        {turn.text || <em style={{ color: 'var(--muted)' }}>empty</em>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
              <button
                onClick={() => exportConversationJSONL(conversationModal.sessionId, conversationModal.conversation)}
                style={{ ...saveBtnStyle, flex: 'unset', padding: '10px 18px' }}
              >
                Export JSONL
              </button>
              <button onClick={() => setConversationModal(null)} style={{ ...cancelBtnStyle, flex: 'unset', minWidth: 100 }}>Close</button>
            </div>
          </Modal>
        );
      })()}

      {/* Analytics side panel */}
      {analyticsPanel && (
        <AnalyticsPanel
          panel={analyticsPanel}
          commissionPct={commissionPct}
          therapistCommissionPct={therapistCommissionPct}
          onClose={() => setAnalyticsPanel(null)}
          onRefetch={(from, to) => {
            if (!analyticsPanel.entityId) return;
            if (analyticsPanel.type === 'listener') openListenerAnalytics(analyticsPanel.entityId, from, to);
            else openTherapistAnalytics(analyticsPanel.entityId, from, to);
          }}
        />
      )}

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:none; } }
        @keyframes slideInRight { from { transform:translateX(100%); opacity:0; } to { transform:none; opacity:1; } }
      `}</style>
    </div>
  );
}

/* ─── Analytics Panel ──────────────────────────────────────────────── */

type FilterPeriod = 'all' | '1d' | '7d' | '30d' | 'custom';

function AnalyticsPanel({ panel, commissionPct, therapistCommissionPct, onClose, onRefetch }: {
  panel: { type: 'listener' | 'therapist'; data: ListenerAnalytics | TherapistAnalytics };
  commissionPct: number;
  therapistCommissionPct: number;
  onClose: () => void;
  onRefetch?: (from?: string, to?: string) => void;
}) {
  const isListener = panel.type === 'listener';
  const [filter, setFilter] = React.useState<FilterPeriod>('all');
  const [customFrom, setCustomFrom] = React.useState('');
  const [customTo, setCustomTo] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const applyFilter = React.useCallback(async (period: FilterPeriod, from?: string, to?: string) => {
    if (!onRefetch) return;
    setLoading(true);
    const now = new Date();
    let f: string | undefined;
    let t: string | undefined;
    if (period === '1d') {
      const d = new Date(now); d.setDate(d.getDate() - 1);
      f = d.toISOString(); t = now.toISOString();
    } else if (period === '7d') {
      const d = new Date(now); d.setDate(d.getDate() - 7);
      f = d.toISOString(); t = now.toISOString();
    } else if (period === '30d') {
      const d = new Date(now); d.setMonth(d.getMonth() - 1);
      f = d.toISOString(); t = now.toISOString();
    } else if (period === 'custom') {
      f = from ? new Date(from).toISOString() : undefined;
      t = to ? new Date(to + 'T23:59:59').toISOString() : undefined;
    }
    await onRefetch(f, t);
    setLoading(false);
  }, [onRefetch, isListener]);

  const handleFilterClick = (period: FilterPeriod) => {
    setFilter(period);
    if (period !== 'custom') applyFilter(period);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.4)', backdropFilter: 'blur(4px)', zIndex: 300 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, background: 'var(--card)', zIndex: 301, overflowY: 'auto', animation: 'slideInRight 0.3s ease', boxShadow: '-8px 0 40px rgba(0,0,0,0.12)' }}>
        {/* Header */}
        <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--card)', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--muted)', fontWeight: 600, marginBottom: 6 }}>{isListener ? 'Listener' : 'Therapist'} Analytics</div>
              <h2 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>{panel.data.name}</h2>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{panel.data.email}</div>
            </div>
            <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
          {isListener ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999, background: (panel.data as ListenerAnalytics).isAvailable ? 'var(--sage-soft)' : 'var(--bg-2)', fontSize: 12, fontWeight: 600, color: (panel.data as ListenerAnalytics).isAvailable ? 'var(--sage)' : 'var(--muted)' }}>
                {(panel.data as ListenerAnalytics).isAvailable ? '● Online now' : '○ Offline'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '4px 12px', borderRadius: 999, background: 'rgba(130,100,180,0.1)', fontSize: 12, fontWeight: 600, color: 'var(--ink-2)' }}>
              {(panel.data as TherapistAnalytics).title}
            </div>
          )}

          {/* Date filter */}
          {(
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([['all', 'All time'], ['1d', '1 Day'], ['7d', '7 Days'], ['30d', '30 Days'], ['custom', 'Custom']] as [FilterPeriod, string][]).map(([key, label]) => (
                  <button key={key} onClick={() => handleFilterClick(key)} style={{
                    padding: '5px 13px', borderRadius: 999, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 500,
                    background: filter === key ? 'var(--sage)' : 'var(--bg-2)',
                    color: filter === key ? '#FBF8F0' : 'var(--muted)',
                    outline: filter === key ? 'none' : '1px solid var(--line)',
                    transition: 'all 0.15s',
                  }}>{label}</button>
                ))}
              </div>
              {filter === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                    style={{ ...{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12 } }} />
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>to</span>
                  <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                    style={{ ...{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 12 } }} />
                  <button onClick={() => applyFilter('custom', customFrom, customTo)}
                    disabled={!customFrom && !customTo}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                      background: 'var(--sage)', color: '#FBF8F0', fontSize: 12, fontWeight: 500,
                      opacity: (!customFrom && !customTo) ? 0.45 : 1,
                    }}>Apply</button>
                </div>
              )}
              {loading && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>Loading…</div>}
              {!loading && filter !== 'all' && ((panel.data as ListenerAnalytics).isFiltered || (panel.data as TherapistAnalytics).filtered) && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  {isListener ? 'Showing data from call logs for selected period' : 'Showing appointments within selected date range'}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: 28 }}>
          {isListener ? (
            <ListenerAnalyticsContent data={panel.data as ListenerAnalytics} commissionPct={commissionPct} />
          ) : (
            <TherapistAnalyticsContent data={panel.data as TherapistAnalytics} commissionPct={therapistCommissionPct} />
          )}
        </div>
      </div>
    </>
  );
}

function ListenerAnalyticsContent({ data, commissionPct }: { data: ListenerAnalytics; commissionPct: number }) {
  const rate = data.costPerMin ?? data.payRatePerMinute ?? 0;
  // Recompute gross from minutes × rate — backend estimatedEarnings is the same but may be stale
  const gross = parseFloat(((data.totalMinutes || 0) * rate).toFixed(2));
  const platformCut = parseFloat((gross * commissionPct / 100).toFixed(2));
  const netPayout = parseFloat((gross - platformCut).toFixed(2));
  // Use avgDuration from backend aggregate if available, otherwise compute locally
  const avgDuration = data.avgDuration ?? (data.totalCalls ? Math.round((data.totalMinutes || 0) / data.totalCalls) : 0);
  const specs = data.specialties || [];
  const joinDate = data.joinedAt ? new Date(data.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCard label="Total Calls" value={String(data.totalCalls || 0)} icon="📞" color="var(--sage-soft)" />
        <StatCard label="Total Hours" value={`${data.totalHours || 0}h`} icon="⏱️" color="rgba(100,140,200,0.12)" />
        <StatCard label="Avg Duration" value={`${avgDuration} min`} icon="⌛" color="rgba(200,160,80,0.12)" />
        <StatCard label="Gross Earnings" value={`₹${gross.toLocaleString('en-IN')}`} icon="💰" color="rgba(80,160,120,0.12)" />
      </div>

      {/* Rating */}
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>User Rating</div>
        {data.rating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="serif" style={{ fontSize: 42, fontWeight: 400, color: 'var(--ink)', lineHeight: 1 }}>{Number(data.rating).toFixed(1)}</div>
            <div>
              <StarRating value={data.rating} large />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Based on call feedback</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--muted)' }}>No ratings yet</div>
        )}
      </div>

      {/* Time breakdown */}
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>Time Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BarRow label="Total talk time" value={data.totalMinutes || 0} max={Math.max(data.totalMinutes || 1, 1)} unit="min" color="var(--sage)" />
          <BarRow label="Total hours" value={parseFloat((data.totalHours || 0).toFixed(1))} max={Math.max(data.totalHours || 1, 1)} unit="hrs" color="rgba(100,140,200,0.8)" />
          <BarRow label="Avg call length" value={avgDuration} max={Math.max(avgDuration, 1)} unit="min" color="rgba(200,160,80,0.8)" />
        </div>
      </div>

      {/* Earnings breakdown */}
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>Earnings Breakdown</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)' }}>Rate per minute</span>
          <span style={{ fontWeight: 600 }}>₹{rate}/min</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)' }}>Total minutes</span>
          <span style={{ fontWeight: 600 }}>{data.totalMinutes || 0} min</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)' }}>Gross earnings</span>
          <span style={{ fontWeight: 600 }}>₹{gross.toLocaleString('en-IN')}</span>
        </div>
        {commissionPct > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>Platform cut ({commissionPct}%)</span>
            <span style={{ fontWeight: 600, color: 'rgba(200,80,80,0.85)' }}>− ₹{platformCut.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
          <span style={{ fontWeight: 600 }}>Net payout to listener</span>
          <span style={{ fontWeight: 700, color: 'var(--sage)' }}>₹{netPayout.toLocaleString('en-IN')}</span>
        </div>
        {commissionPct > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
            <span style={{ color: 'var(--muted)' }}>Platform revenue</span>
            <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>₹{platformCut.toLocaleString('en-IN')}</span>
          </div>
        )}
      </div>

      {/* Specialties */}
      {specs.length > 0 && (
        <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>Specialties</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {specs.map(s => <span key={s} style={{ ...tagStyle, padding: '5px 12px', fontSize: 13 }}>{s}</span>)}
          </div>
        </div>
      )}

      {/* Bio */}
      {data.bio && (
        <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>Bio</div>
          <p style={{ fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, margin: 0 }}>{data.bio}</p>
        </div>
      )}

      {/* Joined */}
      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Member since {joinDate}</div>
    </div>
  );
}

function TherapistAnalyticsContent({ data, commissionPct }: { data: TherapistAnalytics; commissionPct: number }) {
  const total = data.totalSessions || 0;
  const completed = data.completedSessions || 0;
  const confirmed = data.confirmedSessions || 0;
  const pending = data.pendingSessions || 0;
  const cancelled = data.cancelledSessions || 0;
  const completionRate = total ? Math.round((completed / total) * 100) : 0;
  const specs = data.specialties || [];
  const sessionRate = data.rate || 0;
  const gross = completed * sessionRate;
  const platformCut = parseFloat((gross * commissionPct / 100).toFixed(2));
  const netPayout = parseFloat((gross - platformCut).toFixed(2));
  const joinDate = data.joinedAt ? new Date(data.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <StatCard label="Total Sessions" value={String(total)} icon="📅" color="rgba(130,100,180,0.12)" />
        <StatCard label="This Month" value={String(data.sessionsThisMonth || 0)} icon="🗓️" color="var(--sage-soft)" />
        <StatCard label="Completed" value={String(completed)} icon="✅" color="rgba(80,160,120,0.12)" />
        <StatCard label="Completion Rate" value={`${completionRate}%`} icon="📊" color="rgba(100,140,200,0.12)" />
      </div>

      {/* Session breakdown bar chart */}
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>Session Breakdown</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BarRow label="Completed" value={completed} max={Math.max(total, 1)} unit="sessions" color="var(--sage)" />
          <BarRow label="Confirmed (upcoming)" value={confirmed} max={Math.max(total, 1)} unit="sessions" color="rgba(100,140,200,0.9)" />
          <BarRow label="Pending" value={pending} max={Math.max(total, 1)} unit="sessions" color="rgba(200,160,80,0.9)" />
          <BarRow label="Cancelled" value={cancelled} max={Math.max(total, 1)} unit="sessions" color="rgba(200,80,80,0.7)" />
        </div>
      </div>

      {/* Rating */}
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>Patient Rating</div>
        {data.rating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="serif" style={{ fontSize: 42, fontWeight: 400, lineHeight: 1 }}>{Number(data.rating).toFixed(1)}</div>
            <div>
              <StarRating value={data.rating} large />
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Based on session feedback</div>
            </div>
          </div>
        ) : <div style={{ fontSize: 14, color: 'var(--muted)' }}>No ratings yet</div>}
      </div>

      {/* Profile info */}
      <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>Profile</div>
        {[['Experience', data.experience || '—'], ['Title', data.title || '—']].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>{k}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Earnings breakdown */}
      {sessionRate > 0 && (
        <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 14 }}>Earnings Breakdown</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>Session rate</span>
            <span style={{ fontWeight: 600 }}>₹{sessionRate}/session</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>Completed sessions</span>
            <span style={{ fontWeight: 600 }}>{completed}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>Gross earnings</span>
            <span style={{ fontWeight: 600 }}>₹{gross.toLocaleString('en-IN')}</span>
          </div>
          {commissionPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
              <span style={{ color: 'var(--muted)' }}>Platform cut ({commissionPct}%)</span>
              <span style={{ fontWeight: 600, color: 'rgba(200,80,80,0.85)' }}>− ₹{platformCut.toLocaleString('en-IN')}</span>
            </div>
          )}
          <div style={{ borderTop: '1px solid var(--line)', marginTop: 10, paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
            <span style={{ fontWeight: 600 }}>Net payout to therapist</span>
            <span style={{ fontWeight: 700, color: 'rgba(130,100,180,0.9)' }}>₹{netPayout.toLocaleString('en-IN')}</span>
          </div>
          {commissionPct > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 6 }}>
              <span style={{ color: 'var(--muted)' }}>Platform revenue</span>
              <span style={{ fontWeight: 600, color: 'var(--ink-2)' }}>₹{platformCut.toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      )}

      {/* Specialties */}
      {specs.length > 0 && (
        <div style={{ background: 'var(--bg)', borderRadius: 16, padding: 20 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--muted)', fontWeight: 600, marginBottom: 12 }}>Specialties</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {specs.map(s => <span key={s} style={{ padding: '5px 12px', borderRadius: 8, background: 'rgba(130,100,180,0.1)', color: 'var(--ink-2)', fontSize: 13 }}>{s}</span>)}
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>Member since {joinDate}</div>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
  return (
    <div style={{ background: color, borderRadius: 14, padding: '16px 18px' }}>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div className="serif" style={{ fontSize: 26, fontWeight: 400, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function BarRow({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}>
        <span style={{ color: 'var(--muted)' }}>{label}</span>
        <span style={{ fontWeight: 500 }}>{value} {unit}</span>
      </div>
      <div style={{ height: 8, background: 'var(--line)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

function StarRating({ value, large }: { value: number; large?: boolean }) {
  const size = large ? 18 : 14;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i <= Math.round(value) ? '#F5A623' : 'none'} stroke="#F5A623" strokeWidth="1.8">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
      <span style={{ fontSize: large ? 13 : 12, color: 'var(--muted)', marginLeft: 4 }}>{Number(value).toFixed(1)}</span>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px dashed var(--line)', borderRadius: 20, padding: '60px 40px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{sub}</div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: '48px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
      Loading…
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,42,36,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: 24 }} onClick={onClose}>
      <div style={{ background: 'var(--card)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', animation: 'fadeUp 0.25s ease' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 className="serif" style={{ fontSize: 22, fontWeight: 400, margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, onSave, disabled, label }: { onCancel: () => void; onSave: () => void; disabled: boolean; label: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
      <button onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
      <button onClick={onSave} disabled={disabled} style={{ ...saveBtnStyle, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>{label}</button>
    </div>
  );
}

function FormCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 20, padding: 24 }}>
      <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600, marginBottom: 20 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>{label.toUpperCase()}</label>
      {children}
    </div>
  );
}

function ReportGearMenu({ onSuspend }: { onSuspend: () => void }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Account actions"
        style={{
          width: 30, height: 30, borderRadius: 8, border: '1px solid var(--line)',
          background: open ? 'var(--bg-2)' : 'var(--card)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--muted)', transition: 'all 0.15s',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 36, zIndex: 50,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 12, boxShadow: '0 8px 24px rgba(31,42,36,0.14)',
          minWidth: 170, overflow: 'hidden', animation: 'fadeUp 0.15s ease',
        }}>
          <div style={{ padding: '8px 12px 4px', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>
            Account Actions
          </div>
          <button
            onClick={() => { setOpen(false); onSuspend(); }}
            style={{
              width: '100%', padding: '10px 14px', border: 'none', background: 'none',
              cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 9,
              fontSize: 13, color: '#7C1D1D', fontWeight: 500,
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(124,29,29,0.06)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
            Suspend Account
          </button>
        </div>
      )}
    </div>
  );
}

function TblBtn({ label, onClick, danger, accent }: { label: string; onClick: () => void; danger?: boolean; accent?: boolean }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
      background: danger ? '#FEE2E2' : accent ? 'var(--sage-soft)' : 'var(--bg)',
      color: danger ? '#991B1B' : accent ? 'var(--sage)' : 'var(--ink)',
      outline: `1px solid ${danger ? '#FECACA' : accent ? 'transparent' : 'var(--line)'}`,
      transition: 'opacity 0.15s',
    }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >{label}</button>
  );
}

function DashboardNav({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const router = useRouter();
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(245,241,232,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--line)', padding: '0 clamp(16px, 4vw, 48px)', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Logo size={40} />
        <Wordmark size={18} />
        <span style={{ marginLeft: 8, padding: '3px 10px', borderRadius: 999, background: 'var(--peach)', color: '#7A4A2E', fontSize: 11, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>Admin</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Client View
        </button>
        <button onClick={() => router.push('/profile')} style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Profile</button>
        <span style={{ fontSize: 14, color: 'var(--muted)' }}>{name}</span>
        <button onClick={onSignOut} style={{ padding: '7px 16px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
          Sign out
        </button>
      </div>
    </nav>
  );
}

/* ─── KPI card for the top stats bar (with count-up + skeleton) ─── */

function KpiCard({ label, value, sub, color, Icon, delay, loading }: {
  label: string; value: string | number; sub: string; color: string;
  Icon: () => React.ReactElement; delay: number; loading: boolean;
}) {
  const numericTarget = typeof value === 'number' ? value : (typeof value === 'string' && !isNaN(parseFloat(value)) ? parseFloat(value) : null);
  const animated = useCountUp(loading ? null : numericTarget, 900);
  const display = loading
    ? '—'
    : numericTarget !== null
      ? (Number.isInteger(numericTarget) ? animated.toLocaleString('en-IN') : animated.toFixed(1))
      : String(value);

  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 18, padding: '18px 20px', animation: `fadeUp 0.35s ease ${delay}s both` }}>
      <div style={{ width: 36, height: 36, borderRadius: 11, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        <Icon />
      </div>
      <div className="serif" style={{
        fontSize: 28, fontWeight: 400, lineHeight: 1, fontVariantNumeric: 'tabular-nums',
        color: loading ? 'transparent' : 'var(--ink)',
        background: loading ? 'var(--line)' : 'none',
        borderRadius: loading ? 6 : 0,
        minWidth: loading ? 60 : 'auto', display: 'inline-block',
      }}>{display}</div>
      <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 5, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function useCountUp(target: number | null, duration = 950): number {
  const [val, setVal] = React.useState(0);
  React.useEffect(() => {
    if (target === null) return;
    let rafId: number;
    let start: number | null = null;
    rafId = requestAnimationFrame(function tick(ts) {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) rafId = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(rafId);
  }, [target, duration]);
  return val;
}

/* ─── Icons ────────────────────────────────────────────────────────── */
const HeadphoneIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5z"/><path d="M3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"/></svg>;
const TherapistIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const CallIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.63a19.79 19.79 0 01-3.07-8.67A2 2 0 012 .82h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>;
const TranscriptIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/></svg>;
const AIIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 9h.01M15 9h.01M9 15h6"/></svg>;
const UsersIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>;
const ClockIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>;
const StarIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>;
const ReportIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V3"/></svg>;

/* ─── Styles ───────────────────────────────────────────────────────── */
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' };
const tdStyle: React.CSSProperties = { padding: '14px 20px', fontSize: 14, color: 'var(--ink)', verticalAlign: 'middle' };
const thStyle: React.CSSProperties = { padding: '14px 20px', textAlign: 'left', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 };
const addBtnStyle: React.CSSProperties = { padding: '10px 22px', borderRadius: 10, border: 'none', background: 'var(--sage)', color: '#FBF8F0', fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const tagStyle: React.CSSProperties = { padding: '3px 9px', borderRadius: 6, background: 'var(--sage-soft)', color: 'var(--sage)', fontSize: 11, fontWeight: 500 };
const cancelBtnStyle: React.CSSProperties = { flex: 1, padding: '11px', borderRadius: 10, border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted)', fontSize: 14, cursor: 'pointer' };
const saveBtnStyle: React.CSSProperties = { flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: 'var(--sage)', color: '#FBF8F0', fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const savePrimaryBtnStyle: React.CSSProperties = { padding: '13px 32px', borderRadius: 14, border: 'none', background: 'var(--sage)', color: '#FBF8F0', fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(80,107,90,0.3)' };
