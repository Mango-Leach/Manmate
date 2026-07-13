'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser, getRoleDashboard, getToken } from '@/lib/api';
import { FavoriteHeart } from './FavoriteHeart';
import { io, type Socket } from 'socket.io-client';

function getSocketUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
  if (raw.startsWith('http')) return raw;
  if (!raw.includes('.')) return `https://${raw}.onrender.com`;
  return raw.includes('localhost') || raw.includes('127.0.0.1') ? `http://${raw}` : `https://${raw}`;
}

type Stage = 'searching' | 'chatting' | 'ended';

interface Message {
  id: string;
  text: string;
  senderName: string;
  isOwn: boolean;
  timestamp: number;
}

const CHAT_STYLES = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.4; }
  }
  @keyframes msgIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

export function ChatSession() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const isPeerMode = searchParams.get('mode') === 'peer';
  const user = getCurrentUser();
  const dashboardPath = getRoleDashboard(user?.role);
  const isListener = user?.role === 'listener';
  // "Connect again": reconnect to a specific favorite listener by email.
  const directTo = searchParams.get('to') || undefined;
  const isDirect = !!directTo && !isPeerMode && !isListener;

  const [stage, setStage] = useState<Stage>('searching');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [peerName, setPeerName] = useState('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [callProposed, setCallProposed] = useState(false);
  const [callProposedByPeer, setCallProposedByPeer] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [endedMsg, setEndedMsg] = useState('');
  const [chatElapsed, setChatElapsed] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef('');
  const matchRoleRef = useRef('');
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const peerNameRef = useRef('');
  const costPerMinRef = useRef(0);
  const billingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialBalanceRef = useRef<number | null>(null);
  const listenerEmailRef = useRef<string>('');
  const chatBackupLoggedRef = useRef(false);

  function getDisplayName(): string {
    if (!user?.email) return user?.name || 'Anonymous';
    try {
      const extras = JSON.parse(localStorage.getItem(`profile_extras_${user.email}`) || '{}');
      return (extras.listenerName as string | undefined)?.trim() || user.name.split(' ')[0] || 'Anonymous';
    } catch { return user.name || 'Anonymous'; }
  }

  useEffect(() => {
    const socket = io(getSocketUrl(), { transports: ['websocket', 'polling'], reconnection: false });
    socketRef.current = socket;
    const freshUser = getCurrentUser();
    const myRole: 'listener' | 'client' = freshUser?.role === 'listener' ? 'listener' : 'client';

    socket.on('connect', () => {
      const payload = {
        name: getDisplayName(),
        email: freshUser?.email || `anon_${socket.id}@temp.com`,
        role: myRole,
      };
      if (isDirect) {
        socket.emit('request-direct-match', { ...payload, targetEmail: directTo, kind: 'chat', role: 'client' });
      } else if (isPeerMode) {
        socket.emit('request-peer-chat-match', payload);
      } else {
        socket.emit('request-chat-match', payload);
      }
    });

    socket.on('chat-match-found', ({ roomId, role, peer }: { roomId: string; role: string; peer: { name: string; role: string; costPerMin?: number; email?: string } }) => {
      roomIdRef.current = roomId;
      matchRoleRef.current = role;
      peerNameRef.current = peer.name || (isPeerMode ? 'Peer' : peer.role === 'listener' ? 'Listener' : 'Client');
      setPeerName(peerNameRef.current);
      setStage('chatting');
      socket.emit('join-chat-room', { roomId, role });

      // Capture listener email for backup call logging
      if (peer.role === 'listener' && peer.email) {
        listenerEmailRef.current = peer.email;
      }

      // Start per-minute billing for client sessions with a listener
      const rate = peer.costPerMin || 0;
      if (!isPeerMode && peer.role === 'listener' && rate > 0) {
        costPerMinRef.current = rate;
        const freshUser = getCurrentUser();
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
        // Fetch initial balance — stored in ref; display updates per-second via chatElapsed
        fetch(`${apiBase}/api/users/${encodeURIComponent(freshUser?.email || '')}/wallet`, {
          headers: { Authorization: `Bearer ${getToken() || ''}` },
        })
          .then(r => r.json())
          .then(res => { if (res.success) initialBalanceRef.current = res.balance ?? 0; })
          .catch(() => {});
        // Deduct every 10 seconds (costPerMin / 6)
        billingIntervalRef.current = setInterval(async () => {
          try {
            const chunk = parseFloat((costPerMinRef.current / 6).toFixed(4));
            const token = getToken() || '';
            const res = await fetch(
              `${apiBase}/api/users/${encodeURIComponent(freshUser?.email || '')}/wallet/deduct`,
              { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ amount: chunk, description: `Chat session ₹${costPerMinRef.current}/min` }) }
            ).then(r => r.json());
            // Stop the session the moment the wallet reaches exactly ₹0 — either
            // because funds ran out (402) or the final partial chunk drained the
            // balance to zero (depleted flag). The balance can never go negative.
            if (res.error === 'insufficient_funds' || res.depleted === true || (res.success && (res.balance ?? 1) <= 0)) {
              if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
              socket.emit('end-chat', { roomId: roomIdRef.current });
              setEndedMsg('Session ended: your wallet balance reached ₹0.');
              setStage('ended');
            }
          } catch { /* network error — session continues, retry next tick */ }
        }, 10000);
      }
    });

    socket.on('receive-message', ({ text, senderName, timestamp }: { text: string; senderName: string; timestamp: number }) => {
      setMessages(prev => [...prev, { id: `${timestamp}_${Math.random()}`, text, senderName, isOwn: false, timestamp }]);
    });

    socket.on('user-typing', ({ isTyping }: { isTyping: boolean }) => {
      setPeerTyping(isTyping);
      if (peerTypingTimerRef.current) clearTimeout(peerTypingTimerRef.current);
      if (isTyping) {
        peerTypingTimerRef.current = setTimeout(() => setPeerTyping(false), 3500);
      }
    });

    socket.on('call-proposed', () => setCallProposedByPeer(true));

    socket.on('call-rejected', () => {
      setCallProposed(false);
      setMessages(prev => [...prev, {
        id: `sys_${Date.now()}`, text: 'Voice call was declined. Continue chatting.',
        senderName: '', isOwn: false, timestamp: Date.now(),
      }]);
    });

    socket.on('call-upgrade-approved', ({ roomId, role }: { roomId: string; role: 'user' | 'listener' }) => {
      // Stop chat billing — PeerCall will continue billing for the call
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      sessionStorage.setItem('peer_call_upgrade', JSON.stringify({ roomId, role, peerName: peerNameRef.current, costPerMin: costPerMinRef.current }));
      socket.disconnect();
      router.push('/peer-call');
    });

    socket.on('chat-ended', ({ message }: { message: string }) => {
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      setEndedMsg(message);
      setStage('ended');
    });

    socket.on('peer-disconnected', () => {
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      setEndedMsg('Your chat partner disconnected.');
      setStage('ended');
    });

    return () => {
      if (billingIntervalRef.current) { clearInterval(billingIntervalRef.current); billingIntervalRef.current = null; }
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Wait timer for searching stage
  useEffect(() => {
    if (stage !== 'searching') return;
    const timer = setInterval(() => setWaitSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // Elapsed timer for chatting stage — drives per-second billing display
  useEffect(() => {
    if (stage !== 'chatting') return;
    const timer = setInterval(() => setChatElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, [stage]);

  // Frontend backup session log — fires when chat ends, records the client's history
  useEffect(() => {
    if (stage !== 'ended') return;
    if (chatBackupLoggedRef.current) return;
    if (chatElapsed < 5) return;
    if (user?.role === 'listener' || user?.role === 'therapist') return;
    // Listener sessions need the listener email; peer sessions are logged by name only.
    if (!isPeerMode && !listenerEmailRef.current) return;

    chatBackupLoggedRef.current = true;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const token = getToken() || '';
    const body = isPeerMode
      ? {
          counterpart: 'peer',
          listenerName: peerNameRef.current || 'Peer',
          clientEmail: user?.email || '',
          durationSeconds: chatElapsed,
          sessionType: 'chat',
        }
      : {
          listenerEmail: listenerEmailRef.current,
          listenerName: peerNameRef.current || '',
          clientEmail: user?.email || '',
          durationSeconds: chatElapsed,
          sessionType: 'chat',
        };
    fetch(`${apiBase}/api/calls/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
      .then(r => r.json())
      .then(res => console.log('[ChatLog] backup result:', res))
      .catch(err => console.warn('[ChatLog] backup failed:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, peerTyping]);

  const sendMessage = useCallback(() => {
    if (!inputText.trim() || !socketRef.current || stage !== 'chatting') return;
    const text = inputText.trim();
    const timestamp = Date.now();
    const name = getDisplayName();
    setMessages(prev => [...prev, { id: `${timestamp}_own`, text, senderName: name, isOwn: true, timestamp }]);
    socketRef.current.emit('send-message', { roomId: roomIdRef.current, text, senderName: name });
    // Stop the typing indicator
    socketRef.current.emit('typing', { roomId: roomIdRef.current, isTyping: false, senderName: name });
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    setInputText('');
  }, [inputText, stage]);

  function handleInputChange(value: string) {
    setInputText(value);
    if (!socketRef.current) return;
    const name = getDisplayName();
    socketRef.current.emit('typing', { roomId: roomIdRef.current, isTyping: true, senderName: name });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { roomId: roomIdRef.current, isTyping: false, senderName: name });
      typingTimerRef.current = null;
    }, 1800);
  }

  function proposeCall() {
    setCallProposed(true);
    socketRef.current?.emit('propose-call', { roomId: roomIdRef.current });
  }

  function acceptCallProposal() {
    socketRef.current?.emit('accept-call', { roomId: roomIdRef.current });
    setCallProposedByPeer(false);
  }

  function rejectCallProposal() {
    socketRef.current?.emit('reject-call', { roomId: roomIdRef.current });
    setCallProposedByPeer(false);
  }

  function endChat() {
    socketRef.current?.emit('end-chat', { roomId: roomIdRef.current });
    socketRef.current?.disconnect();
    router.refresh();
    router.push(dashboardPath);
  }

  // Per-second billing display — computed from chatElapsed so it updates every second
  const chatRatePerSec = costPerMinRef.current / 60;
  const chatDisplayDeducted = parseFloat((chatElapsed * chatRatePerSec).toFixed(2));
  // Never display a negative balance — the wallet stops at exactly ₹0 (M-9).
  const chatDisplayBalance = initialBalanceRef.current !== null
    ? Math.max(0, parseFloat((initialBalanceRef.current - chatDisplayDeducted).toFixed(2)))
    : null;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <style>{CHAT_STYLES}</style>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: isMobile ? 8 : 0,
        padding: isMobile ? '10px 14px' : '0 24px',
        minHeight: 64,
        flexWrap: isMobile ? 'wrap' : 'nowrap',
        borderBottom: '1px solid var(--line)',
        background: 'var(--bg)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, minWidth: 0, flex: isMobile ? '1 1 auto' : '0 1 auto' }}>
          <button onClick={() => { router.refresh(); router.push(dashboardPath); }} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 14, padding: '6px 10px', borderRadius: 8, flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            {!isMobile && 'Dashboard'}
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--line)', flexShrink: 0 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--lavender-soft)', color: 'var(--lavender)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 600, fontSize: 14,
            }}>
              {stage === 'chatting' ? peerName.charAt(0).toUpperCase() : '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {stage === 'chatting' ? peerName : stage === 'ended' ? 'Session ended' : isPeerMode ? 'Finding a peer…' : isListener ? 'Waiting for a client…' : 'Finding a listener…'}
              </div>
              {stage === 'chatting' && (
                <div style={{ fontSize: 12, color: 'var(--lavender)', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lavender)', display: 'inline-block' }} />
                  {isPeerMode ? 'Peer' : isListener ? 'Client' : 'Listener'} · Active chat session
                </div>
              )}
            </div>
          </div>
        </div>

        {stage === 'chatting' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 6 : 10, flexShrink: 0, flexWrap: isMobile ? 'wrap' : 'nowrap', justifyContent: 'flex-end' }}>
            {/* Live wallet widget — only for paying clients */}
            {!isPeerMode && !isListener && costPerMinRef.current > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: isMobile ? '5px 10px' : '6px 14px', borderRadius: 999,
                background: 'var(--card)', border: '1px solid var(--line)',
                fontSize: isMobile ? 12 : 13, minWidth: 0, flexShrink: 1, flexWrap: 'wrap',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--sage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h2"/>
                </svg>
                {chatDisplayBalance !== null ? (
                  <span style={{ color: chatDisplayBalance < costPerMinRef.current * 3 ? 'var(--alert)' : 'var(--ink)' }}>
                    ₹<strong style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, chatDisplayBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    <span style={{ color: 'var(--muted)', marginLeft: 3 }}>left</span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--muted)' }}>…</span>
                )}
                {chatDisplayDeducted > 0 && (
                  <span style={{ color: 'var(--alert)', fontVariantNumeric: 'tabular-nums', marginLeft: 2 }}>
                    · −₹{chatDisplayDeducted.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
                <span style={{
                  padding: '2px 7px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: 'var(--sage-soft)', color: 'var(--sage)',
                }}>
                  ₹{costPerMinRef.current}/min
                </span>
              </div>
            )}
            {!isListener && (
              <FavoriteHeart
                name={peerName}
                role={isPeerMode ? 'peer' : 'listener'}
                email={listenerEmailRef.current || undefined}
                mode="chat"
                variant="icon"
              />
            )}
            {!callProposed && (
              <button onClick={proposeCall} title="Switch to voice call" style={{
                padding: isMobile ? '8px 12px' : '8px 16px', borderRadius: 10,
                border: '1px solid var(--line)', background: 'var(--card)',
                color: 'var(--ink)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--lavender)'; e.currentTarget.style.color = 'var(--lavender)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.color = 'var(--ink)'; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/>
                </svg>
                {!isMobile && 'Switch to voice call'}
              </button>
            )}
            {callProposed && (
              <div style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'var(--lavender-soft)', color: 'var(--lavender)',
                fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--lavender)', animation: 'pulse 1.5s infinite' }} />
                Waiting for {peerName}…
              </div>
            )}
            <button onClick={endChat} style={{
              padding: isMobile ? '8px 12px' : '8px 16px', borderRadius: 10,
              border: '1px solid var(--line)', background: 'var(--card)',
              color: 'var(--alert)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, whiteSpace: 'nowrap',
              transition: 'all 0.2s',
            }}>
              End chat
            </button>
          </div>
        )}
      </div>

      {/* Call proposed by peer — banner */}
      {callProposedByPeer && (
        <div style={{
          background: 'var(--lavender-soft)', borderBottom: '1px solid var(--lavender-soft)',
          padding: isMobile ? '12px 14px' : '14px 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap',
          animation: 'fadeUp 0.2s ease both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'var(--lavender)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2A19.8 19.8 0 013.1 5.18 2 2 0 015.09 3h3a2 2 0 012 1.72c.13 1 .38 1.96.72 2.88a2 2 0 01-.45 2.11L9.09 11a16 16 0 006.91 6.91l1.27-1.27a2 2 0 012.11-.45c.92.34 1.88.59 2.88.72A2 2 0 0122 18.92z"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--lavender)' }}>{peerName} wants to switch to a voice call</div>
              <div style={{ fontSize: 12, color: 'var(--lavender)', opacity: 0.75 }}>You can continue chatting if you prefer</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={acceptCallProposal} style={{
              padding: '8px 18px', borderRadius: 10,
              background: 'var(--lavender)', color: '#fff',
              border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>
              Accept call
            </button>
            <button onClick={rejectCallProposal} style={{
              padding: '8px 18px', borderRadius: 10,
              background: 'rgba(255,255,255,0.6)', color: 'var(--lavender)',
              border: '1px solid var(--lavender-soft)', fontSize: 13, fontWeight: 500, cursor: 'pointer',
            }}>
              Stay in chat
            </button>
          </div>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Searching state */}
        {stage === 'searching' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 20, animation: 'fadeUp 0.4s ease both',
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              border: '3px solid var(--lavender-soft)',
              borderTopColor: 'var(--lavender)',
              animation: 'spin 1s linear infinite',
            }} />
            <div>
              <div className="serif" style={{ fontSize: 28, fontWeight: 400, textAlign: 'center', color: 'var(--ink)' }}>
                {isPeerMode ? 'Finding a peer for you' : isListener ? 'Waiting for someone to connect' : 'Finding a listener for you'}
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', marginTop: 8 }}>
                {isPeerMode ? 'Matching you with someone who understands' : isListener ? 'You\'ll be matched when a client requests chat' : 'This usually takes under a minute'} · {waitSeconds}s
              </div>
            </div>
            <button onClick={() => { socketRef.current?.disconnect(); router.refresh(); router.push(dashboardPath); }} style={{
              marginTop: 8, padding: '10px 20px', borderRadius: 10,
              border: '1px solid var(--line)', background: 'var(--card)',
              color: 'var(--muted)', fontSize: 14, cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        )}

        {/* Ended state */}
        {stage === 'ended' && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 16, animation: 'fadeUp 0.4s ease both',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--bg-2)', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
            </div>
            <div className="serif" style={{ fontSize: 26, fontWeight: 400, color: 'var(--ink)' }}>Chat ended</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>{endedMsg || 'The session has concluded.'}</div>
            {peerName && !isListener && (
              <FavoriteHeart
                name={peerName}
                role={isPeerMode ? 'peer' : 'listener'}
                email={listenerEmailRef.current || undefined}
                mode="chat"
                variant="full"
              />
            )}
            <button onClick={() => { router.refresh(); router.push(dashboardPath); }} style={{
              marginTop: 8, padding: '12px 28px', borderRadius: 12,
              background: 'var(--lavender)', color: '#fff', border: 'none',
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}>
              Back to dashboard
            </button>
          </div>
        )}

        {/* Chat state */}
        {stage === 'chatting' && (
          <>
            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: isMobile ? '16px 16px' : '24px 32px',
              display: 'flex', flexDirection: 'column', gap: 4,
            }}>
              {/* Session start indicator */}
              <div style={{ textAlign: 'center', margin: '8px 0 20px' }}>
                <span style={{
                  fontSize: 12, color: 'var(--muted)',
                  background: 'var(--bg-2)', padding: '4px 14px', borderRadius: 999,
                }}>
                  You are now chatting with {peerName} · Messages are private
                </span>
              </div>

              {messages.map((msg, i) => {
                const isSystem = msg.senderName === '';
                if (isSystem) {
                  return (
                    <div key={msg.id} style={{ textAlign: 'center', margin: '8px 0' }}>
                      <span style={{
                        fontSize: 12, color: 'var(--muted)',
                        background: 'var(--bg-2)', padding: '4px 14px', borderRadius: 999,
                      }}>{msg.text}</span>
                    </div>
                  );
                }

                const showLabel = i === 0 || messages[i - 1]?.isOwn !== msg.isOwn || messages[i - 1]?.senderName === '';
                return (
                  <div key={msg.id} style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: msg.isOwn ? 'flex-end' : 'flex-start',
                    marginTop: showLabel ? 12 : 3,
                    animation: 'msgIn 0.2s ease both',
                  }}>
                    {showLabel && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, paddingLeft: msg.isOwn ? 0 : 4, paddingRight: msg.isOwn ? 4 : 0 }}>
                        {msg.isOwn ? 'You' : msg.senderName}
                      </div>
                    )}
                    <div style={{
                      maxWidth: isMobile ? '82%' : '65%', padding: '10px 14px', borderRadius: 16,
                      wordBreak: 'break-word', overflowWrap: 'anywhere',
                      borderBottomRightRadius: msg.isOwn ? 4 : 16,
                      borderBottomLeftRadius: msg.isOwn ? 16 : 4,
                      background: msg.isOwn ? 'var(--lavender)' : 'var(--card)',
                      color: msg.isOwn ? '#fff' : 'var(--ink)',
                      fontSize: 15, lineHeight: 1.55,
                      border: msg.isOwn ? 'none' : '1px solid var(--line)',
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3, paddingLeft: msg.isOwn ? 0 : 4, paddingRight: msg.isOwn ? 4 : 0 }}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                );
              })}

              {/* Typing indicator */}
              {peerTyping && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
                  <div style={{
                    padding: '10px 16px', borderRadius: 16, borderBottomLeftRadius: 4,
                    background: 'var(--card)', border: '1px solid var(--line)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {[0, 1, 2].map(d => (
                      <span key={d} style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: 'var(--muted)',
                        animation: `pulse 1.2s ease ${d * 0.2}s infinite`,
                        display: 'inline-block',
                      }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', paddingBottom: 2 }}>{peerName} is typing</div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: isMobile ? '12px 14px' : '16px 24px', borderTop: '1px solid var(--line)',
              background: 'var(--bg)', flexShrink: 0,
              display: 'flex', gap: 10, alignItems: 'flex-end',
            }}>
              <textarea
                value={inputText}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                }}
                placeholder={`Message ${peerName}…`}
                rows={1}
                style={{
                  flex: 1, resize: 'none', padding: '12px 16px',
                  borderRadius: 14, border: '1px solid var(--line)',
                  background: 'var(--card)', color: 'var(--ink)',
                  fontSize: 15, fontFamily: 'inherit', lineHeight: 1.5,
                  outline: 'none', transition: 'border-color 0.2s',
                  maxHeight: 120, overflowY: 'auto',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--lavender)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; }}
              />
              <button
                onClick={sendMessage}
                disabled={!inputText.trim()}
                style={{
                  width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                  background: inputText.trim() ? 'var(--lavender)' : 'var(--bg-2)',
                  color: inputText.trim() ? '#fff' : 'var(--muted)',
                  border: 'none', cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
