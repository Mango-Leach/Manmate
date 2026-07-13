'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Icon } from './primitives';
import { Orb } from './Orb';
import { apiCall, getCurrentUser, getRoleDashboard } from '@/lib/api';

type Phase = 'connecting' | 'connected' | 'error';
type Msg = { who: 'ai' | 'user'; text: string };
type ChatMsg = { who: 'ai' | 'user'; text: string };

export function AICall() {
  return (
    <ConversationProvider>
      <AICallInner />
    </ConversationProvider>
  );
}

function AICallInner() {
  const router = useRouter();
  const user = getCurrentUser();
  const dashboardPath = getRoleDashboard(user?.role);

  const [phase, setPhase] = React.useState<Phase>('connecting');
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);
  const [transcript, setTranscript] = React.useState<Msg[]>([]);

  // Text chat panel — separate message list from the voice transcript
  const [chatOpen, setChatOpen] = React.useState(false);
  const [chatMessages, setChatMessages] = React.useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = React.useState('');
  // Counts how many text messages are waiting for a reply from Serenity
  const pendingTextReplies = React.useRef(0);
  const chatEndRef = React.useRef<HTMLDivElement | null>(null);
  const chatInputRef = React.useRef<HTMLTextAreaElement | null>(null);

  const elapsedRef = React.useRef(0);
  const loggedRef = React.useRef(false);
  const startedRef = React.useRef(false);

  const logSession = React.useCallback(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    const durationSeconds = elapsedRef.current;
    if (durationSeconds < 1 || !user?.email) return;
    apiCall('/api/calls/log', {
      method: 'POST',
      body: JSON.stringify({
        counterpart: 'ai',
        clientEmail: user.email,
        durationSeconds,
        sessionType: 'call',
      }),
    }).catch((err) => console.warn('[Serenity] call log failed:', err));
  }, [user?.email]);

  const conversation = useConversation({
    onConnect: () => setPhase('connected'),
    onDisconnect: () => { logSession(); },
    onError: (message: string) => {
      setErrorMsg(message || 'Something went wrong connecting to Serenity.');
      setPhase('error');
    },
    onMessage: ({ message, source }: { message: string; source: 'user' | 'ai' }) => {
      if (!message) return;
      // Live captions on the main stage use the full voice transcript
      setTranscript((prev) => [...prev, { who: source === 'user' ? 'user' : 'ai', text: message }]);
      // Route Serenity's reply into the chat panel when a text message is pending
      if (source === 'ai' && pendingTextReplies.current > 0) {
        pendingTextReplies.current -= 1;
        setChatMessages((prev) => [...prev, { who: 'ai', text: message }]);
      }
    },
  });

  const { status, isSpeaking, isMuted, setMuted, startSession, endSession, sendUserMessage } = conversation;
  const callState: 'listening' | 'speaking' = isSpeaking ? 'speaking' : 'listening';

  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        setPhase('connecting');
        const { signedUrl } = await apiCall('/api/ai-call/signed-url');
        startSession({ signedUrl });
      } catch (err: any) {
        setErrorMsg(err?.message || 'Could not start the voice session.');
        setPhase('error');
      }
    })();
    return () => { endSession(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (status !== 'connected') return;
    const id = setInterval(() => {
      setElapsed((e) => { elapsedRef.current = e + 1; return e + 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // Scroll chat to latest message
  React.useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatOpen]);

  // Focus input when chat opens
  React.useEffect(() => {
    if (chatOpen) setTimeout(() => chatInputRef.current?.focus(), 80);
  }, [chatOpen]);

  const handleEnd = React.useCallback(() => {
    endSession();
    logSession();
    router.push(dashboardPath);
  }, [endSession, logSession, router, dashboardPath]);

  // Send typed text to Serenity over the live WebSocket session.
  // ElevenLabs never echoes the user's text back, so we add it to chatMessages
  // immediately. We also increment pendingTextReplies so onMessage knows the
  // next AI response belongs in the chat panel.
  const handleChatSend = React.useCallback(() => {
    const text = chatInput.trim();
    if (!text || status !== 'connected') return;
    setChatMessages((prev) => [...prev, { who: 'user', text }]);
    pendingTextReplies.current += 1;
    sendUserMessage(text);
    setChatInput('');
  }, [chatInput, status, sendUserMessage]);

  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
  };

  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  // Last 2 transcript lines used as live captions on the main stage
  const captions = transcript.slice(-2);

  const headline =
    phase === 'connecting' ? 'Connecting you to Serenity…'
    : phase === 'error' ? 'I could not connect right now.'
    : callState === 'speaking' ? 'Serenity is speaking…'
    : isMuted ? 'You are muted'
    : 'Serenity is listening';

  return (
    <div style={{
      minHeight: '100svh', background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflowX: 'hidden',
    }}>
      {/* Ambient glow — behind everything */}
      <div aria-hidden style={{
        position: 'fixed', top: '-20vh', left: '50%', transform: 'translateX(-50%)',
        width: '140vw', height: '140vw', maxWidth: 1400,
        borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(closest-side, var(--sage-soft), transparent 60%)',
        opacity: callState === 'speaking' ? 0.7 : 0.4, transition: 'opacity 1.2s',
      }} />

      {/* ── Header ── */}
      <div style={{
        position: 'relative', zIndex: 10,
        padding: 'clamp(12px,2.5vw,20px) clamp(16px,4vw,40px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 8,
      }}>
        <button onClick={() => router.push(dashboardPath)} style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--card)', border: '1px solid var(--line)',
          padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
          fontSize: 13, color: 'var(--ink-2)', whiteSpace: 'nowrap',
        }}>
          {Icon.back(13)} Back
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 16px', borderRadius: 999,
          background: 'var(--card)', border: '1px solid var(--line)',
          fontSize: 13, color: 'var(--ink-2)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
            background: phase === 'error' ? 'var(--alert)' : 'var(--sage)',
            animation: phase !== 'error' ? 'pulse 1.5s infinite' : 'none',
          }} />
          Session · <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>{mm}:{ss}</strong>
        </div>
      </div>

      {/* ── Main stage ── */}
      <div style={{
        flex: 1, position: 'relative', zIndex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px 160px',
      }}>
        <div style={{ marginBottom: 36 }}>
          <Orb size={300} state={callState} orbStyle="aurora" speaking={callState === 'speaking'} />
        </div>

        <div style={{
          fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase',
          color: 'var(--muted)', fontWeight: 600, marginBottom: 12,
        }}>
          {headline}
        </div>

        {/* Live captions — last 2 transcript lines */}
        <div style={{
          width: '100%', maxWidth: 560, minHeight: 80,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 8, textAlign: 'center',
        }}>
          {phase === 'error' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {errorMsg && <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380 }}>{errorMsg}</div>}
              <button onClick={() => { startedRef.current = false; loggedRef.current = false; setTranscript([]); window.location.reload(); }} style={{
                padding: '10px 22px', borderRadius: 999,
                background: 'var(--sage)', color: '#FBF8F0',
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              }}>Try again</button>
            </div>
          ) : captions.length === 0 ? (
            <div className="serif" style={{ fontSize: 24, color: 'var(--ink)', opacity: 0.4, lineHeight: 1.3 }}>
              {phase === 'connecting' ? '…' : 'Take a breath. I have got time.'}
            </div>
          ) : captions.map((m, i) => (
            <div key={i} className={m.who === 'ai' ? 'serif' : ''} style={{
              fontSize: m.who === 'ai' ? (i === captions.length - 1 ? 24 : 17) : 15,
              color: m.who === 'ai' ? 'var(--ink)' : 'var(--muted)',
              lineHeight: 1.35,
              opacity: i === captions.length - 1 ? 1 : 0.45,
              transition: 'opacity 0.4s',
              maxWidth: 520,
            }}>
              {m.who === 'user' ? <em>"{m.text}"</em> : m.text}
            </div>
          ))}

          {callState === 'speaking' && (
            <div style={{ display: 'flex', gap: 5, padding: '6px 0', marginTop: 4 }}>
              {[0, 1, 2].map(i => (
                <span key={i} style={{
                  width: 7, height: 7, borderRadius: '50%', background: 'var(--sage)',
                  animation: `bounce 1.2s ${i * 0.15}s infinite`,
                }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Text chat panel ── */}
      {chatOpen && (
        <div style={{
          position: 'fixed', bottom: 108, left: '50%', transform: 'translateX(-50%)',
          width: 'min(480px, calc(100vw - 32px))', zIndex: 20,
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 20, boxShadow: '0 20px 60px rgba(31,42,36,0.16)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          animation: 'slideUp 0.2s ease',
        }}>
          {/* Panel header */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid var(--line)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--sage)', flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Chat with Serenity</span>
            </div>
            <button onClick={() => setChatOpen(false)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: '2px 6px', borderRadius: 6,
            }}>×</button>
          </div>

          {/* Full transcript shown as chat messages */}
          <div style={{
            height: 260, overflowY: 'auto', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {chatMessages.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic', textAlign: 'center', marginTop: 80 }}>
                {status === 'connected'
                  ? 'Type a message below — Serenity will reply.'
                  : 'Connecting to Serenity…'}
              </div>
            )}
            {chatMessages.map((m, i) => (
              <div key={i} style={{ alignSelf: m.who === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
                <div style={{
                  fontSize: 10.5, color: 'var(--muted)', marginBottom: 3,
                  textAlign: m.who === 'user' ? 'right' : 'left',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {m.who === 'user' ? 'You' : 'Serenity'}
                </div>
                <div className={m.who === 'ai' ? 'serif' : ''} style={{
                  padding: '9px 13px', borderRadius: 12,
                  background: m.who === 'user' ? 'var(--bg-2)' : 'var(--sage-soft)',
                  color: 'var(--ink)',
                  fontSize: m.who === 'ai' ? 14.5 : 14,
                  lineHeight: 1.45,
                }}>{m.text}</div>
              </div>
            ))}
            {pendingTextReplies.current > 0 && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '8px 4px' }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage)', animation: `bounce 1.2s ${i * 0.15}s infinite` }} />
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid var(--line)',
            display: 'flex', gap: 8, alignItems: 'flex-end',
          }}>
            <textarea
              ref={chatInputRef}
              rows={1}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleChatKeyDown}
              placeholder={status === 'connected' ? 'Type a message… (Enter to send)' : 'Connecting…'}
              disabled={status !== 'connected'}
              style={{
                flex: 1, resize: 'none',
                border: '1px solid var(--line)', borderRadius: 10,
                padding: '9px 13px', background: 'var(--bg)',
                color: 'var(--ink)', fontSize: 14, outline: 'none',
                fontFamily: 'inherit', lineHeight: 1.4,
                maxHeight: 96, overflowY: 'auto',
                opacity: status !== 'connected' ? 0.5 : 1,
              }}
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || status !== 'connected'}
              style={{
                width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                background: chatInput.trim() && status === 'connected' ? 'var(--sage)' : 'var(--bg-2)',
                color: chatInput.trim() && status === 'connected' ? '#FBF8F0' : 'var(--muted)',
                cursor: chatInput.trim() && status === 'connected' ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.18s',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* ── Call bar ── */}
      <div style={{
        position: 'fixed', bottom: 28, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', zIndex: 15,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: 12,
          borderRadius: 999, background: 'var(--card)',
          border: '1px solid var(--line)',
          boxShadow: '0 16px 40px rgba(31,42,36,0.13)',
        }}>
          <CallBtn label={isMuted ? 'Unmute' : 'Mute'} disabled={phase !== 'connected'} onClick={() => setMuted(!isMuted)}>
            {isMuted ? Icon.micOff(20) : Icon.mic(20)}
          </CallBtn>
          <CallBtn label="Chat with Serenity" active={chatOpen} onClick={() => setChatOpen((o) => !o)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
          </CallBtn>
          <CallBtn danger label="End call" onClick={handleEnd}>
            {Icon.phoneDown(20)}
          </CallBtn>
        </div>
      </div>
    </div>
  );
}

function CallBtn({ children, danger = false, active = false, label, onClick, disabled = false }: {
  children: React.ReactNode; danger?: boolean; active?: boolean;
  label: string; onClick?: () => void; disabled?: boolean;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: active
            ? 'var(--sage)'
            : hover && !disabled
              ? (danger ? '#9B5B4E' : 'var(--sage-soft)')
              : (danger ? 'var(--alert)' : 'var(--bg-2)'),
          color: (danger || active) ? '#FBF8F0' : 'var(--ink)',
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.18s',
        }}
      >{children}</button>
      {hover && (
        <div style={{
          position: 'absolute', bottom: -30, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--ink)', color: 'var(--bg)', fontSize: 11,
          padding: '3px 9px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>{label}</div>
      )}
    </div>
  );
}
