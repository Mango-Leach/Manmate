'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { Icon, Avatar, Pill, Button } from './primitives';
import { FavoriteHeart } from './FavoriteHeart';
import { getCurrentUser, getRoleDashboard, getToken } from '@/lib/api';
import { io, type Socket } from 'socket.io-client';

// ── Config ─────────────────────────────────────────────────────────────────────

// Build the ICE server list. STUN alone only works when both peers are on the
// same network — cross-network/NAT calls need a TURN relay or they hang forever
// on "Connecting…". A TURN server can be supplied via env (recommended for
// production); otherwise we fall back to the free public Open Relay TURN so calls
// still connect out of the box.
function buildIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCred = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;

  if (turnUrl && turnUser && turnCred) {
    // Support a comma-separated list of TURN URLs in one env var
    servers.push({ urls: turnUrl.split(',').map(u => u.trim()).filter(Boolean), username: turnUser, credential: turnCred });
  } else {
    // Free public TURN fallback (Open Relay by Metered). Fine for testing / low
    // volume; replace with your own TURN credentials via env for production.
    servers.push(
      { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    );
  }

  return servers;
}

const ICE_SERVERS: RTCConfiguration = {
  iceServers: buildIceServers(),
  // Pre-gather ICE candidates before negotiation starts — cuts connection time by ~3s
  iceCandidatePoolSize: 10,
};

function getSocketUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (raw.startsWith('http')) return raw;
  if (!raw.includes('.')) return `https://${raw}.onrender.com`;
  return raw.includes('localhost') || raw.includes('127.0.0.1') ? `http://${raw}` : `https://${raw}`;
}

// ── Types ──────────────────────────────────────────────────────────────────────

type Stage = 'ready' | 'matching' | 'connecting' | 'connected' | 'ended' | 'low-balance';

interface MatchPayload {
  roomId: string;
  role: 'user' | 'listener';
  peer: { name: string; role: string; socketId: string; costPerMin?: number; email?: string };
}

interface RoomReadyPayload { user: string; listener: string; }

// ── Component ──────────────────────────────────────────────────────────────────

export function PeerCall({ mode = 'listener', directTo }: { mode?: 'listener' | 'peer'; directTo?: string }) {
  const router = useRouter();
  const user = getCurrentUser();
  const dashboardPath = getRoleDashboard(user?.role);
  // Listeners must not use peer mode — silently redirect them to listener mode
  const isPeerMode = mode === 'peer' && user?.role !== 'listener' && user?.role !== 'therapist';
  // "Connect again": reconnect to a specific favorite listener by email.
  const isDirect = !!directTo && user?.role !== 'listener' && user?.role !== 'therapist' && !isPeerMode;

  const [stage, setStage] = React.useState<Stage>('matching');
  const [waitTime, setWaitTime] = React.useState(0);
  const [elapsed, setElapsed] = React.useState(0);
  const [muted, setMuted] = React.useState(false);
  const [peerName, setPeerName] = React.useState('');
  const [peerRole, setPeerRole] = React.useState('listener');
  const [error, setError] = React.useState<string | null>(null);
  const [transcriptStatus, setTranscriptStatus] = React.useState<'idle' | 'recording' | 'saving' | 'saved' | 'error'>('idle');
  const [queueStats, setQueueStats] = React.useState({ listenersWaiting: 0, clientsWaiting: 0 });
  const [reportOpen, setReportOpen] = React.useState(false);

  // Refs — stable across renders, not trigger re-renders
  const socketRef = React.useRef<Socket | null>(null);
  const pcRef = React.useRef<RTCPeerConnection | null>(null);
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const roomRef = React.useRef('');
  const signalRoleRef = React.useRef<'user' | 'listener'>('user');
  const peerSocketRef = React.useRef('');

  // Queues for messages that may arrive before PC is ready
  const pendingOfferRef = React.useRef<{ offer: RTCSessionDescriptionInit; from: string } | null>(null);
  const pendingCandidatesRef = React.useRef<RTCIceCandidateInit[]>([]);
  const hasSentInitialOfferRef = React.useRef(false);

  const cleanupFnRef = React.useRef<() => void>(() => {});
  const roomReadyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const costPerMinRef = React.useRef(0);
  const billingIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const initialBalanceRef = React.useRef<number | null>(null);
  const listenerEmailRef = React.useRef<string>('');
  const peerEmailRef = React.useRef<string>('');
  const backupLoggedRef = React.useRef(false);
  const transcriptRecorderRef = React.useRef<MediaRecorder | null>(null);
  const transcriptChunksRef = React.useRef<Blob[]>([]);
  const transcriptUploadPendingRef = React.useRef(false);
  const transcriptStartTimeRef = React.useRef<number | null>(null);
  const transcriptStopWaitRef = React.useRef<Promise<void> | null>(null);
  const transcriptStopResolveRef = React.useRef<(() => void) | null>(null);

  // ── Setup audio element + auto-start on mount ───────────────────────────────
  React.useEffect(() => {
    // Start muted — muted autoplay is always allowed by browser policy.
    // We unmute immediately after setting srcObject in ontrack, which does
    // not require a user gesture. This bypasses the autoplay block entirely.
    const audio = document.createElement('audio');
    audio.autoplay = true;
    audio.muted = true;
    audio.setAttribute('playsinline', '');
    audio.style.display = 'none';
    document.body.appendChild(audio);
    remoteAudioRef.current = audio;

    // Start immediately — no ReadyScreen, browser handles the mic permission
    // dialog natively. Matching screen is already visible while waiting.
    handleMicAndStart();

    return () => {
      cleanupFnRef.current();
      audio.pause();
      audio.srcObject = null;
      audio.parentNode?.removeChild(audio);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Mic permission + socket connect (called from button click = user gesture) ─

  function getDisplayName(): string {
    if (!user?.email) return user?.name || 'Anonymous';
    try {
      const extras = JSON.parse(localStorage.getItem(`profile_extras_${user.email}`) || '{}');
      return (extras.listenerName as string | undefined)?.trim() || user.name.split(' ')[0] || 'Anonymous';
    } catch { return user.name || 'Anonymous'; }
  }

  function getTranscriptSpeaker(): 'client' | 'listener' | 'peer' | 'unknown' {
    if (user?.role === 'listener') return 'listener';
    if (user?.role === 'client') return 'client';
    if (isPeerMode) return 'peer';
    return 'unknown';
  }

  function shouldCaptureTranscription(): boolean {
    // Transcription only for listener-client calls (not peer mode).
    const should = !isPeerMode;
    console.log('[Transcription] shouldCaptureTranscription:', should, '{ isPeerMode:', isPeerMode, ', mode:', mode, ', userRole:', user?.role, '}');
    return should;
  }

  async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        resolve(result.split(',')[1] || '');
      };
      reader.onerror = () => reject(new Error('Failed to encode audio'));
      reader.readAsDataURL(blob);
    });
  }

  async function uploadTranscriptBlob(blob: Blob) {
    if (!shouldCaptureTranscription()) {
      console.log('[Transcription] Upload skipped - not a listener-call (isPeerMode=', isPeerMode, ')');
      return;
    }
    if (!user?.email || transcriptUploadPendingRef.current) {
      console.log('[Transcription] Upload skipped - pending or no email');
      return;
    }
    transcriptUploadPendingRef.current = true;
    setTranscriptStatus('saving');
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
      const token = getToken() || '';
      const audioBase64 = await blobToBase64(blob);
      const sessionId = roomRef.current || `call-${Date.now()}`;
      const speaker = getTranscriptSpeaker();
      console.log('[Transcription] Uploading:', { sessionId, speaker, blobSize: blob.size, apiBase });
      const response = await fetch(`${apiBase}/api/transcribe/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          sessionId,
          callId: roomRef.current || '',
          speaker,
          filename: `call-${Date.now()}.webm`,
          audioBase64,
          archiveToGoogle: false,
        }),
      });
      const res = await response.json().catch(() => ({}));
      console.log('[Transcription] Response:', { status: response.status, res });
      if (!response.ok) {
        throw new Error(res?.error || res?.message || `Upload failed (${response.status})`);
      }
      if (!res?.saved) throw new Error(res?.error || 'Transcription upload failed');
      console.log('[Transcription] Upload success, transcript saved:', res.saved);
      setTranscriptStatus('saved');
      window.setTimeout(() => setTranscriptStatus('idle'), 2500);
    } catch (err) {
      console.error('[Transcription] Upload failed:', err);
      setTranscriptStatus('error');
      window.setTimeout(() => setTranscriptStatus('idle'), 3500);
    } finally {
      transcriptUploadPendingRef.current = false;
    }
  }

  async function startTranscriptCapture() {
    if (!shouldCaptureTranscription()) {
      console.log('[Transcription] Capture skipped - not a listener-call');
      return;
    }
    if (!localStreamRef.current || transcriptRecorderRef.current) {
      console.log('[Transcription] Capture skipped - stream unavailable or already recording');
      return;
    }
    try {
      console.log('[Transcription] Starting capture for session:', roomRef.current);
      transcriptChunksRef.current = [];
      transcriptStartTimeRef.current = Date.now();
      transcriptStopWaitRef.current = new Promise<void>((resolve) => {
        transcriptStopResolveRef.current = resolve;
      });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(localStreamRef.current, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          transcriptChunksRef.current.push(event.data);
          console.log('[Transcription] Data chunk received:', event.data.size, 'bytes');
        }
      };
      recorder.onstop = async () => {
        const chunks = transcriptChunksRef.current.splice(0);
        console.log('[Transcription] Recorder stopped, total chunks:', chunks.length);
        try {
          if (chunks.length) {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            console.log('[Transcription] Blob created, size:', blob.size);
            await uploadTranscriptBlob(blob);
          }
        } finally {
          transcriptStopResolveRef.current?.();
          transcriptStopResolveRef.current = null;
          transcriptStopWaitRef.current = null;
        }
      };
      recorder.start();
      transcriptRecorderRef.current = recorder;
      setTranscriptStatus('recording');
      console.log('[Transcription] Recording started successfully');
    } catch (err) {
      console.error('[Transcription] Recorder start failed:', err);
      setTranscriptStatus('error');
    }
  }

  async function stopTranscriptCapture() {
    const recorder = transcriptRecorderRef.current;
    if (!recorder) return;

    if (recorder.state === 'inactive') {
      if (transcriptStopWaitRef.current) await transcriptStopWaitRef.current;
      return;
    }

    try {
      recorder.stop();
      // Wait for onstop -> upload pipeline to finish before leaving the page.
      if (transcriptStopWaitRef.current) await transcriptStopWaitRef.current;
    } catch {
      // ignore stop races
    } finally {
      transcriptRecorderRef.current = null;
    }
  }

  async function handleMicAndStart() {
    setError(null);
    try {
      // getUserMedia called from a click handler = user gesture.
      // Explicit constraints: mono 48kHz, all processing enabled, minimal latency.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 48000,
        },
      });
      localStreamRef.current = stream;
    } catch (err) {
      const isDenied = err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' ||
         err.message.toLowerCase().includes('denied'));
      setError(isDenied
        ? 'Microphone access was denied. Please allow it in your browser settings and reload.'
        : 'Could not access your microphone. Please check your device and try again.');
      return; // stay on matching screen — error is shown there
    }

    // Pre-flight balance check — only for paying clients (not peer mode, not listener/therapist)
    if (!isPeerMode && user?.role !== 'listener' && user?.role !== 'therapist' && user?.email) {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        const res = await fetch(`${apiBase}/api/users/${encodeURIComponent(user.email)}/wallet`, {
          headers: { Authorization: `Bearer ${getToken() || ''}` },
        }).then(r => r.json());
        if (res.success && (res.balance ?? 0) <= 0) {
          setStage('low-balance');
          return;
        }
      } catch { /* network error — let the call proceed, billing will catch it */ }
    }

    connectSocket();
  }

  // ── Socket setup ─────────────────────────────────────────────────────────────

  function connectSocket() {
    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: false,
      timeout: 10000,
    });
    socketRef.current = socket;

    const myQueueRole = user?.role === 'listener' ? 'listener' : 'client';

    socket.on('connect', () => {
      setError(null);

      // Check if this call was upgraded from a chat session
      const upgradeRaw = sessionStorage.getItem('peer_call_upgrade');
      if (upgradeRaw) {
        try {
          const upgrade = JSON.parse(upgradeRaw) as { roomId: string; role: 'user' | 'listener'; peerName: string; costPerMin?: number };
          sessionStorage.removeItem('peer_call_upgrade');
          roomRef.current = upgrade.roomId;
          signalRoleRef.current = upgrade.role;
          // If the client was the 'user' role in the chat, they are connecting to a listener
          if (upgrade.role === 'user' && (upgrade.costPerMin || 0) > 0) {
            costPerMinRef.current = upgrade.costPerMin!;
          }
          setPeerName(upgrade.peerName || 'Your chat partner');
          setPeerRole(upgrade.role === 'user' ? 'listener' : 'user');
          setStage('connecting');
          initPC(socket).then(() => {
            socket.emit('join-room', { roomId: upgrade.roomId, role: upgrade.role, userId: user?.email || socket.id });
          }).catch(() => {});
          return;
        } catch { /* ignore parse errors, fall through to normal matchmaking */ }
      }

      socket.emit('get-queue-stats');
      if (isDirect) {
        socket.emit('request-direct-match', {
          targetEmail: directTo,
          kind: 'call',
          name: getDisplayName(),
          email: user?.email || `anon_${socket.id}@temp.com`,
          role: 'client',
        });
      } else if (isPeerMode) {
        socket.emit('request-client-peer-match', {
          name: getDisplayName(),
          email: user?.email || `anon_${socket.id}@temp.com`,
          role: user?.role || 'client',
        });
      } else {
        socket.emit('request-match', {
          name: getDisplayName(),
          email: user?.email || `anon_${socket.id}@temp.com`,
          role: myQueueRole,
        });
      }
    });

    socket.on('connect_error', () => {
      setError('Cannot reach the server. Make sure the backend is running on port 5000.');
    });

    socket.on('queue-update', (s: { listenersWaiting?: number; clientsWaiting?: number }) => {
      setQueueStats({ listenersWaiting: s.listenersWaiting ?? 0, clientsWaiting: s.clientsWaiting ?? 0 });
    });

    // ── Step 1: Match found ───────────────────────────────────────────────────
    socket.on('match-found', async ({ roomId, role, peer }: MatchPayload) => {
      roomRef.current = roomId;
      signalRoleRef.current = role;
      hasSentInitialOfferRef.current = false;
      peerSocketRef.current = peer.socketId;
      setPeerName(peer.name || 'Anonymous');
      setPeerRole(peer.role || 'listener');
      // Capture billing rate: only client (role='user') pays when matched with a listener
      console.log('[Billing] match-found:', { role, peerRole: peer.role, costPerMin: peer.costPerMin });
      if (role === 'user' && peer.role === 'listener' && (peer.costPerMin || 0) > 0) {
        costPerMinRef.current = peer.costPerMin!;
        console.log('[Billing] rate set:', costPerMinRef.current);
      } else {
        console.log('[Billing] rate NOT set — conditions:', { isUser: role === 'user', isListener: peer.role === 'listener', hasRate: (peer.costPerMin || 0) > 0 });
      }
      // Store listener email for frontend backup call logging
      if (peer.role === 'listener' && peer.email) {
        listenerEmailRef.current = peer.email;
      }
      if (peer.email) peerEmailRef.current = peer.email;
      setStage('connecting');

      // If room-ready never fires within 5 s the matched socket is a ghost.
      // Clean up and re-queue so the user goes back to searching.
      if (roomReadyTimerRef.current) clearTimeout(roomReadyTimerRef.current);
      roomReadyTimerRef.current = setTimeout(() => {
        roomReadyTimerRef.current = null;
        pcRef.current?.close();
        pcRef.current = null;
        pendingOfferRef.current = null;
        pendingCandidatesRef.current = [];
        setPeerName('');
        setPeerRole('listener');
        setStage('matching');
        setWaitTime(0);
        if (isDirect) {
          socket.emit('request-direct-match', {
            targetEmail: directTo,
            kind: 'call',
            name: getDisplayName(),
            email: user?.email || `anon_${socket.id}@temp.com`,
            role: 'client',
          });
        } else if (isPeerMode) {
          socket.emit('request-client-peer-match', {
            name: getDisplayName(),
            email: user?.email || `anon_${socket.id}@temp.com`,
            role: user?.role || 'client',
          });
        } else {
          socket.emit('request-match', {
            name: getDisplayName(),
            email: user?.email || `anon_${socket.id}@temp.com`,
            role: myQueueRole,
          });
        }
      }, 5000);

      initPC(socket).then(() => {
        socket.emit('join-room', { roomId, role, userId: user?.email || socket.id });
      }).catch(() => {});
    });

    // ── Step 2: Both peers are in the room ───────────────────────────────────
    socket.on('room-ready', async ({ user: userSock, listener: listenerSock }: RoomReadyPayload) => {
      if (roomReadyTimerRef.current) {
        clearTimeout(roomReadyTimerRef.current);
        roomReadyTimerRef.current = null;
      }

      peerSocketRef.current = signalRoleRef.current === 'user' ? listenerSock : userSock;

      const pc = pcRef.current;
      if (!pc) return;

      if (pendingOfferRef.current) {
        const { offer, from } = pendingOfferRef.current;
        pendingOfferRef.current = null;
        await applyOffer(socket, pc, offer, from);
        await drainCandidates(pc);
        return;
      }

      if (signalRoleRef.current === 'user') {
        // Guard against duplicate room-ready events causing a second offer.
        if (hasSentInitialOfferRef.current) return;
        if (pc.signalingState !== 'stable') return;
        if (pc.localDescription || pc.remoteDescription) return;

        if (shouldCaptureTranscription()) {
          void startTranscriptCapture();
        }

        // voiceActivityDetection:false — VAD causes silence-detection gaps at call start
        // Cast needed because TypeScript DOM lib omits this valid WebRTC spec option
        try {
          const offer = await pc.createOffer({ voiceActivityDetection: false } as RTCOfferOptions);
          await pc.setLocalDescription(offer);
          hasSentInitialOfferRef.current = true;
          socket.emit('offer', { offer, to: listenerSock });
        } catch (err) {
          console.error('[WebRTC] room-ready offer creation failed:', err);
        }
      }
    });

    // ── Step 3a: Listener receives offer ────────────────────────────────────
    socket.on('offer', async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
      peerSocketRef.current = from;
      const pc = pcRef.current;
      if (!pc) { pendingOfferRef.current = { offer, from }; return; }
      await applyOffer(socket, pc, offer, from);
      await drainCandidates(pc);
    });

    // ── Step 3b: User receives answer ───────────────────────────────────────
    socket.on('answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        // Only set remote answer if we don't already have it
        if (!pc.remoteDescription || pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
        await drainCandidates(pc);
      } catch (err) {
        console.warn('[WebRTC] answer handler failed:', err);
      }
    });

    // ── ICE candidate exchange ───────────────────────────────────────────────
    socket.on('ice-candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingCandidatesRef.current.push(candidate);
        return;
      }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    });

    // ── Evicted from queue (idle timeout) ───────────────────────────────────
    socket.on('queue-evicted', () => {
      cleanupFnRef.current();
      router.replace(dashboardPath);
    });

    // ── Peer gone ────────────────────────────────────────────────────────────
    socket.on('peer-disconnected', () => {
      if (roomReadyTimerRef.current) { clearTimeout(roomReadyTimerRef.current); roomReadyTimerRef.current = null; }
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      void stopTranscriptCapture();
      setStage('ended');
    });
    socket.on('peer-left', () => {
      if (roomReadyTimerRef.current) { clearTimeout(roomReadyTimerRef.current); roomReadyTimerRef.current = null; }
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      void stopTranscriptCapture();
      setStage('ended');
    });
    socket.on('match-error', ({ error: msg }: { error: string }) => setError(msg));

    cleanupFnRef.current = () => {
      if (roomReadyTimerRef.current) { clearTimeout(roomReadyTimerRef.current); roomReadyTimerRef.current = null; }
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      void stopTranscriptCapture();
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
      socket.disconnect();
      localStreamRef.current = null;
      pcRef.current = null;
    };
  }

  // ── WebRTC helpers ─────────────────────────────────────────────────────────

  async function initPC(socket: Socket) {
    try {
      // Mic stream was already acquired by user gesture in handleMicAndStart — reuse it.
      const stream = localStreamRef.current!;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (event) => {
        // Some browsers fire ontrack with an empty streams array — fall back to
        // wrapping the track directly so remote audio always gets a valid srcObject.
        const incomingStream = event.streams[0] ?? new MediaStream([event.track]);
        const audioEl = remoteAudioRef.current;
        if (!audioEl) return;
        audioEl.srcObject = incomingStream;
        // play() is allowed on muted elements without a user gesture.
        // Only unmute AFTER play() resolves — unmuting before playback starts
        // causes the browser to treat it as an unmuted autoplay attempt and block it.
        audioEl.play()
          .then(() => { audioEl.muted = false; })
          .catch(err => console.warn('[Audio] play failed:', err));
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate && peerSocketRef.current) {
          socket.emit('ice-candidate', { candidate, to: peerSocketRef.current });
        }
      };

      pc.onconnectionstatechange = () => {
        const s = pc.connectionState;
        console.log('[Billing] connectionState:', s, '| rate:', costPerMinRef.current);
        if (s === 'connected') {
          setStage('connected');
          if (shouldCaptureTranscription()) {
            void startTranscriptCapture();
          }
          // Start per-minute billing for client sessions with a listener
          const rate = costPerMinRef.current;
          if (rate > 0 && !billingIntervalRef.current) {
            const freshUser = getCurrentUser();
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
            console.log('[Billing] starting interval — rate:', rate, 'email:', freshUser?.email, 'apiBase:', apiBase);
            // Fetch initial wallet balance — stored in ref so per-second display can compute from it
            fetch(`${apiBase}/api/users/${encodeURIComponent(freshUser?.email || '')}/wallet`, {
              headers: { Authorization: `Bearer ${getToken() || ''}` },
            })
              .then(r => r.json())
              .then(res => { if (res.success) initialBalanceRef.current = res.balance ?? 0; })
              .catch(() => {});
            // Deduct every 10 seconds (costPerMin / 6); display updates per-second via elapsed
            billingIntervalRef.current = setInterval(async () => {
              try {
                const chunk = parseFloat((costPerMinRef.current / 6).toFixed(4));
                const token = getToken() || '';
                const url = `${apiBase}/api/users/${encodeURIComponent(freshUser?.email || '')}/wallet/deduct`;
                console.log('[Billing] deducting', chunk, 'from', freshUser?.email);
                const res = await fetch(
                  url,
                  { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount: chunk, description: `Listener session ₹${costPerMinRef.current}/min` }) }
                ).then(r => r.json());
                console.log('[Billing] deduct response:', res);
                // Stop the session the moment the wallet reaches exactly ₹0 —
                // either because funds ran out (402) or the final partial chunk
                // drained the balance to zero (depleted flag). Never negative.
                if (res.error === 'insufficient_funds' || res.depleted === true || (res.success && (res.balance ?? 1) <= 0)) {
                  if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
                  cleanupFnRef.current();
                  setStage('ended');
                }
              } catch (err) { console.error('[Billing] deduct fetch failed:', err); }
            }, 10000);
          } else {
            console.log('[Billing] interval NOT started — rate:', rate, 'alreadyRunning:', !!billingIntervalRef.current);
          }
        } else if (s === 'failed' || s === 'closed') {
          if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
          setStage('ended');
        } else if (s === 'disconnected') {
          setTimeout(() => {
            if (pc.connectionState === 'disconnected') {
              if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
              setStage('ended');
            }
          }, 3000);
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Call error';
      setError(`Could not start call: ${msg}`);
      setStage('matching');
      throw err;
    }
  }

  async function applyOffer(socket: Socket, pc: RTCPeerConnection, offer: RTCSessionDescriptionInit, from: string) {
    try {
      // Ignore duplicate offers once a remote description is already applied.
      if (pc.remoteDescription) {
        console.log('[WebRTC] applyOffer: already have remoteDescription, skipping');
        return;
      }
      
      // Connection must be in stable state to set remote offer
      if (pc.signalingState !== 'stable') {
        console.warn('[WebRTC] applyOffer: wrong signalingState for offer:', pc.signalingState, '(expected stable)');
        return;
      }
      
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // After setting remote, state should be have-remote-offer
      if ((pc.signalingState as string) !== 'have-remote-offer') {
        console.warn('[WebRTC] applyOffer: unexpected state after setRemoteDescription:', pc.signalingState);
        return;
      }
      
      const answer = await pc.createAnswer({ voiceActivityDetection: false } as RTCAnswerOptions);
      
      // Check state once more before setting local description
      if ((pc.signalingState as string) !== 'have-remote-offer') {
        console.warn('[WebRTC] applyOffer: state changed before setLocalDescription:', pc.signalingState);
        return;
      }
      
      await pc.setLocalDescription(answer);
      
      if (shouldCaptureTranscription()) {
        void startTranscriptCapture();
      }
      
      socket.emit('answer', { answer, to: from });
    } catch (err) {
      console.error('[WebRTC] applyOffer failed:', err);
    }
  }

  async function drainCandidates(pc: RTCPeerConnection) {
    const queued = pendingCandidatesRef.current.splice(0);
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
    }
  }

  // ── Call end ───────────────────────────────────────────────────────────────

  async function handleEndCall() {
    console.log('[Call] Ending call, sessionId:', roomRef.current);
    if (socketRef.current && roomRef.current) {
      socketRef.current.emit('end-call', { roomId: roomRef.current });
    }
    console.log('[Call] Stopping transcript capture');
    await stopTranscriptCapture();
    console.log('[Call] Transcript capture stopped, cleaning up');
    cleanupFnRef.current();
    setStage('ended');
  }

  // ── Timers ─────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (stage !== 'matching') return;
    const id = setInterval(() => setWaitTime(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  React.useEffect(() => {
    if (stage !== 'connected') return;
    const id = setInterval(() => setElapsed(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [stage]);

  // Watchdog: if ICE never reaches 'connected', don't sit on "Connecting…" forever.
  // Surface an error and drop back to the matching screen so the user can retry.
  React.useEffect(() => {
    if (stage !== 'connecting') return;
    const id = setTimeout(() => {
      if (pcRef.current?.connectionState !== 'connected') {
        console.warn('[WebRTC] connection watchdog fired — still not connected after 30s');
        setError('Could not establish a secure connection — this can happen on restrictive networks. Please try again.');
        setStage('matching');
      }
    }, 30000);
    return () => clearTimeout(id);
  }, [stage]);

  // ── Mute ───────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
  }, [muted]);

  // ── Frontend backup call log (fires when stage → 'ended', client-side only) ──

  React.useEffect(() => {
    if (stage !== 'ended') return;
    if (backupLoggedRef.current) return;
    if (elapsed < 5) return; // skip trivially short calls
    if (user?.role === 'listener' || user?.role === 'therapist') return;
    // Listener calls need the listener email; peer calls are logged by name only.
    if (!isPeerMode && !listenerEmailRef.current) return;

    backupLoggedRef.current = true;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const token = getToken() || '';
    const body = isPeerMode
      ? {
          counterpart: 'peer',
          listenerName: peerName || 'Peer',
          clientEmail: user?.email || '',
          durationSeconds: elapsed,
          sessionType: 'call',
        }
      : {
          listenerEmail: listenerEmailRef.current,
          listenerName: peerName || '',
          clientEmail: user?.email || '',
          durationSeconds: elapsed,
          sessionType: 'call',
        };
    fetch(`${apiBase}/api/calls/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(res => console.log('[CallLog] backup result:', res))
      .catch(err => console.warn('[CallLog] backup failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (stage === 'low-balance') {
    return (
      <LowBalanceScreen
        onTopUp={() => router.push('/dashboard?topup=1')}
        onBack={() => router.push(dashboardPath)}
      />
    );
  }

  if (stage === 'matching') {
    return (
      <MatchingScreen
        waitTime={waitTime}
        error={error}
        isListener={user?.role === 'listener'}
        isPeerMode={isPeerMode}
        queueStats={queueStats}
        onRetry={handleMicAndStart}
        onCancel={() => { cleanupFnRef.current(); router.push(dashboardPath); }}
      />
    );
  }

  if (stage === 'connecting') {
    return <ConnectingScreen peerName={peerName} />;
  }

  if (stage === 'ended') {
    return <EndedScreen
      peerName={peerName}
      favRole={isPeerMode ? 'peer' : 'listener'}
      favEmail={(isPeerMode ? peerEmailRef.current : listenerEmailRef.current) || undefined}
      canFavorite={user?.role !== 'listener' && user?.role !== 'therapist'}
      onDone={() => { router.refresh(); router.push(dashboardPath); }}
    />;
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  // Per-second billing display — computed from elapsed so it updates every second without extra API calls
  const ratePerSec = costPerMinRef.current / 60;
  const displayDeducted = parseFloat((elapsed * ratePerSec).toFixed(2));
  // Never display a negative balance — the wallet stops at exactly ₹0 (M-9).
  const displayBalance = initialBalanceRef.current !== null
    ? Math.max(0, parseFloat((initialBalanceRef.current - displayDeducted).toFixed(2)))
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Ambient glow */}
      <div aria-hidden style={{
        position: 'absolute', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 900, height: 900, borderRadius: '50%', pointerEvents: 'none',
        background: 'radial-gradient(closest-side, var(--lavender-soft), transparent 60%)', opacity: 0.6,
      }} />

      {/* Header bar */}
      <div style={{ padding: 'clamp(14px,3vw,24px) clamp(16px,4vw,48px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Session ID Display */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6,
            background: 'rgba(0,0,0,0.1)', fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace',
          }}>
            <span>Session:</span>
            <code style={{ background: 'rgba(0,0,0,0.05)', padding: '2px 6px', borderRadius: 3, color: 'var(--ink-2)' }}>
              {roomRef.current ? roomRef.current.substring(0, 12) : 'waiting...'}
            </code>
          </div>
          {/* Call timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 16px', borderRadius: 999,
            background: 'var(--card)', border: '1px solid var(--line)', fontSize: 13, color: 'var(--ink-2)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', animation: 'pulse 1.5s infinite' }} />
            Connected · <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{mm}:{ss}</strong>
          </div>

          {/* Live wallet widget — only shown for paying clients (not peer mode, not listener) */}
          {!isPeerMode && user?.role !== 'listener' && user?.role !== 'therapist' && costPerMinRef.current > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 16px', borderRadius: 999,
              background: 'var(--card)', border: '1px solid var(--line)',
              fontSize: 13,
            }}>
              {/* Wallet icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/>
              </svg>
              {displayBalance !== null ? (
                <span style={{ color: displayBalance < costPerMinRef.current * 3 ? 'var(--alert)' : 'var(--ink)' }}>
                  ₹<strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, displayBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                  <span style={{ color: 'var(--muted)', marginLeft: 4 }}>left</span>
                </span>
              ) : (
                <span style={{ color: 'var(--muted)' }}>Loading…</span>
              )}
              {displayDeducted > 0 && (
                <>
                  <span style={{ color: 'var(--line)', margin: '0 2px' }}>·</span>
                  <span style={{ color: 'var(--alert)', fontVariantNumeric: 'tabular-nums' }}>
                    −₹{displayDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>this call</span>
                  </span>
                </>
              )}
              <span style={{
                padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                background: 'var(--sage-soft)', color: 'var(--sage)',
              }}>
                ₹{costPerMinRef.current}/min
              </span>
            </div>
          )}

          {shouldCaptureTranscription() && transcriptStatus !== 'idle' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 999, background: 'var(--card)', border: '1px solid var(--line)',
              fontSize: 13, color: 'var(--ink-2)',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: transcriptStatus === 'error' ? 'var(--alert)' : transcriptStatus === 'saved' ? 'var(--sage)' : 'var(--lavender)' }} />
              {transcriptStatus === 'recording' && 'Transcribing during call'}
              {transcriptStatus === 'saving' && 'Saving transcript…'}
              {transcriptStatus === 'saved' && 'Transcript saved'}
              {transcriptStatus === 'error' && 'Transcript failed'}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {peerName && user?.role !== 'listener' && user?.role !== 'therapist' && (
            <FavoriteHeart
              name={peerName}
              role={isPeerMode ? 'peer' : 'listener'}
              email={(isPeerMode ? peerEmailRef.current : listenerEmailRef.current) || undefined}
              mode="call"
              variant="icon"
            />
          )}
          <Pill tone="lavender">End-to-end encrypted · anonymous</Pill>
        </div>
      </div>

      {/* Low balance warning */}
      {!isPeerMode && user?.role !== 'listener' && displayBalance !== null && costPerMinRef.current > 0 && displayBalance < costPerMinRef.current * 3 && displayBalance > 0 && (
        <div style={{
          margin: '0 48px', padding: '10px 18px', borderRadius: 12,
          background: 'rgba(178,107,92,0.1)', border: '1px solid rgba(178,107,92,0.3)',
          display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--alert)',
          position: 'relative', zIndex: 1,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>
            <strong>Low balance</strong> — ₹{displayBalance!.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} remaining. Your call will end automatically when balance runs out.
          </span>
        </div>
      )}

      {/* Caller tiles */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 clamp(16px, 4vw, 48px) 180px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 80, marginBottom: 64 }}>
          <CallerTile
            name={peerName || 'Peer'}
            role={isPeerMode ? 'Peer' : (peerRole === 'listener' ? 'Peer listener' : 'Anonymous')}
            tone="lavender"
            speaking={true}
            muted={false}
          />
          <div style={{ color: 'var(--muted)', fontSize: 36, opacity: 0.4 }}>·</div>
          <CallerTile
            name={user?.name?.split(' ')[0] || 'You'}
            role="You"
            tone="sage"
            speaking={false}
            muted={muted}
          />
        </div>
        <div style={{ textAlign: 'center', maxWidth: 560 }}>
          <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 14 }}>
            {isPeerMode ? `Connected with ${peerName}` : (peerRole === 'listener' ? `${peerName} is listening` : `Connected with ${peerName}`)}
          </div>
          <div className="serif" style={{ fontSize: 26, lineHeight: 1.3, color: 'var(--ink)', fontStyle: 'italic', fontWeight: 400, letterSpacing: -0.005 }}>
            {isPeerMode
              ? `“You are not alone. Talking to someone who understands makes all the difference.”`
              : `“Take your time. There is no rush — I am here for you.”`}
          </div>
        </div>
      </div>

      {/* Control bar */}
      <div style={{ position: 'absolute', bottom: 32, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 2 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: 14,
          borderRadius: 999, background: 'var(--card)', border: '1px solid var(--line)',
          boxShadow: '0 20px 40px rgba(31,42,36,0.12)',
        }}>
          <PeerBtn label={muted ? 'Unmute' : 'Mute'} onClick={() => setMuted(m => !m)}>
            {muted ? Icon.micOff(22) : Icon.mic(22)}
          </PeerBtn>
          <PeerBtn label="Report" onClick={() => setReportOpen(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <path d="M4 22V3"/>
            </svg>
          </PeerBtn>
          <PeerBtn danger label="End call" onClick={handleEndCall}>
            {Icon.phoneDown(22)}
          </PeerBtn>
        </div>
      </div>

      {reportOpen && (
        <ReportModal
          peerName={peerName}
          peerEmail={peerEmailRef.current}
          sessionId={roomRef.current}
          onClose={() => setReportOpen(false)}
        />
      )}

      <style>{`@keyframes ring { 0%{transform:scale(1);opacity:.6} 100%{transform:scale(1.2);opacity:0} }`}</style>
    </div>
  );
}

// ── Ready screen (mic permission gate) ────────────────────────────────────────

function ReadyScreen({ isListener, isPeerMode, error, onStart, onCancel }: {
  isListener: boolean;
  isPeerMode: boolean;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
}) {
  const [starting, setStarting] = React.useState(false);

  async function handleClick() {
    setStarting(true);
    await onStart();
    setStarting(false);
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 48, position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, var(--lavender-soft), transparent 60%)', opacity: 0.7 }} />

      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 460, animation: 'fadeUp 0.4s ease both' }}>
        {/* Mic icon circle */}
        <div style={{
          width: 128, height: 128, borderRadius: '50%', margin: '0 auto 36px',
          background: error
            ? 'linear-gradient(135deg, var(--alert), #9B5B4E)'
            : 'linear-gradient(135deg, var(--lavender), var(--sage-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#FBF8F0', transition: 'background 0.4s',
        }}>
          {error
            ? <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="12" rx="3"/>
                <path d="M5 11a7 7 0 0014 0"/><path d="M12 18v3"/>
                <line x1="3" y1="3" x2="21" y2="21" strokeWidth="2"/>
              </svg>
            : <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="3" width="6" height="12" rx="3"/>
                <path d="M5 11a7 7 0 0014 0"/>
                <path d="M12 18v3"/>
              </svg>
          }
        </div>

        <h2 className="serif" style={{ fontSize: 38, fontWeight: 400, margin: '0 0 14px', letterSpacing: -0.01 }}>
          {error ? 'Microphone needed' : (isListener ? 'Ready to listen?' : isPeerMode ? 'Ready to connect?' : 'Ready to connect?')}
        </h2>

        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.65, margin: '0 0 32px' }}>
          {error
            ? error
            : isListener
              ? 'To receive calls, your browser needs microphone access. Click below and allow when prompted.'
              : isPeerMode
                ? 'To talk with a peer, your browser needs microphone access. Click below and allow when prompted.'
                : 'To talk with a listener, your browser needs microphone access. Click below and allow when prompted.'
          }
        </p>

        <button
          onClick={handleClick}
          disabled={starting}
          style={{
            display: 'block', width: '100%', padding: '16px 28px',
            borderRadius: 16, border: 'none',
            background: starting ? 'var(--sage-2)' : 'var(--lavender)',
            color: '#FBF8F0', fontSize: 16, fontWeight: 600,
            cursor: starting ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s', marginBottom: 16,
          }}
        >
          {starting ? 'Requesting access…' : (error ? 'Try again' : (isListener ? 'Allow microphone & start listening' : isPeerMode ? 'Allow microphone & find a peer' : 'Allow microphone & find a listener'))}
        </button>

        <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
          Go back
        </button>
      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PeerBtn({ children, danger = false, label, onClick }: {
  children: React.ReactNode; danger?: boolean; label: string; onClick?: () => void;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onClick}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{
          width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: hover ? (danger ? '#9B5B4E' : 'var(--sage-soft)') : (danger ? 'var(--alert)' : 'var(--bg-2)'),
          color: danger ? '#FBF8F0' : 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
        }}>
        {children}
      </button>
      {hover && (
        <div style={{
          position: 'absolute', bottom: -32, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: 'var(--bg)', fontSize: 11,
          padding: '4px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 10,
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

function CallerTile({ name, role, tone, speaking, muted }: {
  name: string; role: string; tone: 'sage' | 'lavender'; speaking: boolean; muted: boolean;
}) {
  const [t, setT] = React.useState(0);
  React.useEffect(() => {
    let raf: number;
    const tick = () => { setT(performance.now() / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const scale = speaking ? 1 + Math.sin(t * 2.5) * 0.03 : 1;
  return (
    <div style={{ textAlign: 'center', position: 'relative' }}>
      <div style={{ position: 'relative', marginBottom: 20, transform: `scale(${scale})` }}>
        {speaking && (
          <div style={{ position: 'absolute', inset: -14, borderRadius: '50%', border: '2px solid var(--lavender)', opacity: 0.5, animation: 'ring 1.6s infinite ease-out' }} />
        )}
        <div style={{ position: 'relative' }}>
          <Avatar name={name} tone={tone} size={180} />
          {muted && (
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: 44, height: 44, borderRadius: '50%',
              background: 'var(--alert)', color: '#FBF8F0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '3px solid var(--bg)',
            }}>
              {Icon.micOff(18)}
            </div>
          )}
        </div>
      </div>
      <div className="serif" style={{ fontSize: 22, fontWeight: 500 }}>{name}</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{role}</div>
    </div>
  );
}

function LowBalanceScreen({ onTopUp, onBack }: { onTopUp: () => void; onBack: () => void }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 48, position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(178,107,92,0.12), transparent 60%)', opacity: 0.9 }} />
      <div style={{ position: 'relative', textAlign: 'center', maxWidth: 420, animation: 'fadeUp 0.4s ease both' }}>
        {/* Icon */}
        <div style={{
          width: 96, height: 96, borderRadius: '50%', margin: '0 auto 32px',
          background: 'linear-gradient(135deg, var(--alert), #9B5B4E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FBF8F0',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/>
          </svg>
        </div>

        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--alert)', fontWeight: 500, marginBottom: 12 }}>
          Insufficient balance
        </div>
        <h2 className="serif" style={{ fontSize: 32, margin: '0 0 14px', fontWeight: 400, letterSpacing: -0.01 }}>
          Your wallet is empty
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Connecting with a listener requires wallet balance. Please top up to continue your session.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <button onClick={onTopUp} style={{
            padding: '14px 36px', borderRadius: 999, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, var(--sage), var(--sage-2))',
            color: '#FBF8F0', fontSize: 15, fontWeight: 600, letterSpacing: 0.2,
            boxShadow: '0 4px 16px rgba(31,42,36,0.18)', transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Top Up Wallet
          </button>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
            Go back
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function ConnectingScreen({ peerName }: { peerName: string }) {
  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 48, position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, var(--lavender-soft), transparent 60%)', opacity: 0.7 }} />
      <div style={{ position: 'relative', textAlign: 'center', animation: 'fadeUp 0.4s ease both' }}>
        <div style={{ position: 'relative', marginBottom: 32 }}>
          <Avatar name={peerName || 'Peer'} tone="lavender" size={120} />
          {[0, 1].map(i => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%', width: 120, height: 120, borderRadius: '50%',
              border: '2px solid var(--lavender)', transform: 'translate(-50%,-50%)',
              animation: `matching 2s ${i * 0.7}s infinite ease-out`,
            }} />
          ))}
        </div>
        <div style={{ fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--lavender)', fontWeight: 500, marginBottom: 12 }}>
          Match found
        </div>
        <h2 className="serif" style={{ fontSize: 38, margin: '0 0 12px', fontWeight: 400, letterSpacing: -0.01 }}>
          Connecting with <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>{peerName || 'your peer'}</em>…
        </h2>
        <p style={{ color: 'var(--muted)', fontSize: 15, marginBottom: 0 }}>
          Setting up a secure, encrypted connection
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 24 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%', background: 'var(--lavender)',
              animation: `bounce 1.2s ${i * 0.2}s infinite ease-in-out`,
            }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes bounce{0%,100%{opacity:.3;transform:translateY(0)}50%{opacity:1;transform:translateY(-5px)}}`}</style>
    </div>
  );
}

function MatchingScreen({ waitTime, error, isListener, isPeerMode, queueStats, onRetry, onCancel }: {
  waitTime: number;
  error: string | null;
  isListener: boolean;
  isPeerMode: boolean;
  queueStats: { listenersWaiting: number; clientsWaiting: number };
  onRetry: () => void;
  onCancel: () => void;
}) {
  const tags = ['Anxiety', 'Bad day', 'Just want to vent', 'Loneliness', 'Family'];
  const { listenersWaiting, clientsWaiting } = queueStats;

  // Topic filters: clicking toggles selection and highlights the chip (M-5).
  // Selections persist across the matching screen re-mounting mid-search.
  const [selectedTags, setSelectedTags] = React.useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('match_topics') || '[]'); } catch { return []; }
  });
  const toggleTag = (tag: string) => {
    setSelectedTags(prev => {
      const next = prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag];
      try { sessionStorage.setItem('match_topics', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 48, position: 'relative', overflow: 'hidden',
    }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, var(--lavender-soft), transparent 60%)', opacity: 0.7 }} />

      <div style={{ position: 'relative', textAlign: 'center' }}>
        {/* Icon circle */}
        <div style={{ position: 'relative', marginBottom: 40 }}>
          <div style={{
            width: 160, height: 160, borderRadius: '50%', margin: '0 auto',
            background: error
              ? 'linear-gradient(135deg,var(--alert),#9B5B4E)'
              : 'linear-gradient(135deg,var(--lavender),var(--sage-2))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#FBF8F0', transition: 'background 0.5s',
          }}>
            {error
              ? <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
              : Icon.users(56)
            }
          </div>
          {!error && [0, 1, 2].map(i => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%', width: 160, height: 160, borderRadius: '50%',
              border: '2px solid var(--lavender)', transform: 'translate(-50%,-50%)',
              animation: `matching 2.5s ${i * 0.8}s infinite ease-out`,
            }} />
          ))}
        </div>

        {error ? (
          <>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 20,
              padding: '8px 16px', borderRadius: 999,
              background: 'rgba(178,107,92,0.12)', color: 'var(--alert)', fontSize: 13, fontWeight: 500,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--alert)' }} />
              Connection error
            </div>
            <h2 className="serif" style={{ fontSize: 36, margin: '0 0 12px', fontWeight: 400 }}>
              Could not connect
            </h2>
            <p style={{ color: 'var(--muted)', maxWidth: 400, margin: '0 auto 28px', fontSize: 15, lineHeight: 1.6 }}>
              {error}
            </p>
            <button onClick={onRetry} style={{
              padding: '12px 28px', borderRadius: 14, border: 'none',
              background: 'var(--lavender)', color: '#FBF8F0',
              fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 12,
            }}>
              Try again
            </button>
            <div style={{ marginTop: 8 }}>
              <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                Go back
              </button>
            </div>
          </>
        ) : (
          <>
            <Pill tone="lavender" style={{ marginBottom: 20 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lavender)', animation: 'pulse 1.5s infinite' }} />
              {isListener ? 'Waiting for someone who needs support' : isPeerMode ? 'Matching you with a peer' : 'Matching you with a listener'}
            </Pill>

            <h2 className="serif" style={{ fontSize: 42, margin: '0 0 16px', fontWeight: 400, letterSpacing: -0.01 }}>
              {isListener
                ? <>Listening for <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>someone…</em></>
                : isPeerMode
                  ? <>Finding a peer who <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>understands…</em></>
                  : <>Finding someone <em style={{ fontStyle: 'italic', color: 'var(--lavender)' }}>kind…</em></>
              }
            </h2>

            <div style={{ fontSize: 15, color: 'var(--muted)', marginBottom: 8 }}>
              {isListener
                ? clientsWaiting > 0
                  ? `${clientsWaiting} ${clientsWaiting === 1 ? 'person needs' : 'people need'} support · waiting ${waitTime}s`
                  : `Waiting for someone to reach out · ${waitTime}s`
                : isPeerMode
                  ? `Waiting for another peer · ${waitTime}s`
                  : listenersWaiting > 0
                    ? `${listenersWaiting} listener${listenersWaiting !== 1 ? 's' : ''} available · waiting ${waitTime}s`
                    : `Waiting for a listener · ${waitTime}s`
              }
            </div>

            {!isListener && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', maxWidth: 540, flexWrap: 'wrap', marginTop: 24 }}>
                {tags.map(tag => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      aria-pressed={isSelected}
                      style={{
                        padding: '10px 16px', borderRadius: 999,
                        border: `1px solid ${isSelected ? 'var(--lavender)' : 'var(--line)'}`,
                        background: isSelected ? 'var(--lavender-soft)' : 'var(--card)',
                        color: isSelected ? 'var(--lavender)' : 'var(--ink-2)',
                        fontWeight: isSelected ? 600 : 400,
                        cursor: 'pointer', fontSize: 13, transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--lavender)'; e.currentTarget.style.color = 'var(--lavender)'; } }}
                      onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink-2)'; } }}
                    >
                      {isSelected ? '✓' : '+'} {tag}
                    </button>
                  );
                })}
              </div>
            )}

            <div style={{ marginTop: 32 }}>
              <button onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}>
                Cancel and go back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const REPORT_REASONS = [
  'Harassment or bullying',
  'Threatening or violent language',
  'Sexual or inappropriate content',
  'Spam or misleading behaviour',
  'Impersonation',
  'Other',
];

function ReportModal({ peerName, peerEmail, sessionId, onClose }: { peerName: string; peerEmail?: string; sessionId?: string; onClose: () => void }) {
  const [selected, setSelected] = React.useState('');
  const [details, setDetails] = React.useState('');
  const [submitted, setSubmitted] = React.useState(false);

  function handleSubmit() {
    if (!selected) return;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const token = getToken() || '';
    fetch(`${apiBase}/api/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reportedUser: peerName, reportedEmail: peerEmail || null, reason: selected, details, sessionId: sessionId || null }),
    }).catch(() => {});
    setSubmitted(true);
    setTimeout(onClose, 1800);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(31,42,36,0.55)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 20, padding: 36, maxWidth: 460, width: '100%',
          boxShadow: '0 24px 64px rgba(31,42,36,0.2)',
          animation: 'fadeUp 0.25s ease both',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%', margin: '0 auto 20px',
              background: 'var(--sage-soft)', color: 'var(--sage)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <h3 className="serif" style={{ fontSize: 24, fontWeight: 400, margin: '0 0 8px' }}>Report submitted</h3>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: 0 }}>Thank you. Our team will review this shortly.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
              <div>
                <h3 className="serif" style={{ fontSize: 22, fontWeight: 500, margin: '0 0 4px' }}>Report user</h3>
                {peerName && (
                  <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>
                    Reporting <strong style={{ color: 'var(--ink-2)' }}>{peerName}</strong>
                  </p>
                )}
              </div>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', padding: 4, marginTop: -2,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Reason list */}
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Reason
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
              {REPORT_REASONS.map(reason => (
                <label key={reason} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${selected === reason ? 'var(--lavender)' : 'var(--line)'}`,
                  background: selected === reason ? 'var(--lavender-soft)' : 'var(--bg)',
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={reason}
                    checked={selected === reason}
                    onChange={() => setSelected(reason)}
                    style={{ accentColor: 'var(--lavender)', width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 14, color: 'var(--ink)', fontWeight: selected === reason ? 500 : 400 }}>{reason}</span>
                </label>
              ))}
            </div>

            {/* Optional details */}
            <textarea
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder="Additional details (optional)"
              rows={3}
              style={{
                width: '100%', resize: 'none', padding: '12px 14px', borderRadius: 12, boxSizing: 'border-box',
                border: '1px solid var(--line)', background: 'var(--bg)',
                color: 'var(--ink)', fontSize: 14, fontFamily: 'inherit',
                outline: 'none', marginBottom: 20, lineHeight: 1.5,
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '12px', borderRadius: 12, border: '1px solid var(--line)',
                background: 'var(--bg)', color: 'var(--ink-2)', fontSize: 14, fontWeight: 500, cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!selected}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  background: selected ? 'var(--alert)' : 'var(--line)',
                  color: selected ? '#FBF8F0' : 'var(--muted)',
                  fontSize: 14, fontWeight: 600, cursor: selected ? 'pointer' : 'not-allowed',
                  transition: 'all 0.15s',
                }}
              >
                Submit report
              </button>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

function EndedScreen({ peerName, favRole, favEmail, canFavorite, onDone }: { peerName: string; favRole: 'listener' | 'peer'; favEmail?: string; canFavorite: boolean; onDone: () => void }) {
  const [rated, setRated] = React.useState(0);
  const [submitted, setSubmitted] = React.useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    setTimeout(onDone, 1200);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48 }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--line)',
        borderRadius: 24, padding: 48, maxWidth: 480, width: '100%',
        textAlign: 'center', animation: 'slideUp 0.4s ease both',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: submitted ? 'var(--lavender-soft)' : 'var(--sage-soft)',
          color: submitted ? 'var(--lavender)' : 'var(--sage)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px', transition: 'all 0.4s',
        }}>
          {submitted
            ? <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            : Icon.heart(32)
          }
        </div>

        {submitted ? (
          <>
            <h2 className="serif" style={{ fontSize: 32, fontWeight: 400, margin: '0 0 12px', letterSpacing: -0.01 }}>Thank you.</h2>
            <p style={{ color: 'var(--ink-2)', margin: 0 }}>Returning to your dashboard…</p>
          </>
        ) : (
          <>
            <h2 className="serif" style={{ fontSize: 32, fontWeight: 400, margin: '0 0 12px', letterSpacing: -0.01 }}>
              Thank you for showing up.
            </h2>
            {peerName && (
              <p style={{ color: 'var(--ink-2)', margin: '0 0 28px' }}>
                How was your time with <strong>{peerName}</strong>?
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
              {[1, 2, 3, 4, 5].map(n => (
                <button key={n} onClick={() => setRated(n)} style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'none')}
                >
                  {Icon.star(30, n <= rated ? 'var(--peach)' : 'var(--line)')}
                </button>
              ))}
            </div>
            {peerName && canFavorite && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <FavoriteHeart name={peerName} role={favRole} email={favEmail} mode="call" variant="full" />
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button tone="ghost" full onClick={onDone}>Skip</Button>
              <Button tone="primary" full onClick={handleSubmit}>Submit feedback</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
