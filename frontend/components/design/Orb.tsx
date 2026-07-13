'use client';
import React from 'react';

type OrbStyle = 'aurora' | 'minimal' | 'waveform';

export function Orb({
  size = 220,
  state = 'idle',
  orbStyle = 'aurora',
  speaking = false,
}: {
  size?: number;
  state?: 'idle' | 'listening' | 'speaking';
  orbStyle?: OrbStyle;
  speaking?: boolean;
}) {
  const [t, setT] = React.useState(0);

  React.useEffect(() => {
    let raf: number;
    const tick = () => { setT(performance.now() / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const breath = 1 + Math.sin(t * (speaking ? 2.4 : 1.1)) * (speaking ? 0.04 : 0.025);
  const rot = (t * (speaking ? 12 : 6)) % 360;

  if (orbStyle === 'minimal') {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 30%,#D8E6DD 0%,#9BB5A3 60%,#506B5A 100%)',
        transform: `scale(${breath})`, transition: 'transform .3s',
      }} />
    );
  }

  if (orbStyle === 'waveform') {
    const bars = 24;
    return (
      <div style={{
        width: size, height: size,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
      }}>
        {Array.from({ length: bars }).map((_, i) => {
          const phase = (i / bars) * Math.PI * 2;
          const wave = Math.abs(Math.sin(t * 3 + phase));
          const idle = 0.1 + 0.05 * Math.sin(t * 1.2 + phase);
          const h = (speaking ? wave : idle) * size * 0.55 + 8;
          return (
            <div key={i} style={{
              width: 4, height: h, borderRadius: 4,
              background: 'linear-gradient(to bottom,var(--sage-2),var(--sage))',
              opacity: speaking ? 0.9 : 0.55,
              transition: 'height .1s',
            }} />
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      width: size, height: size, position: 'relative',
      transform: `scale(${breath})`,
      filter: 'drop-shadow(0 20px 60px rgba(80,107,90,.35))',
    }}>
      <svg viewBox="0 0 200 200" width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <radialGradient id="ob1" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#F5F1E8" />
            <stop offset="0.4" stopColor="#D8E6DD" />
            <stop offset="1" stopColor="#6A8772" />
          </radialGradient>
          <radialGradient id="ob2" cx="0.35" cy="0.3" r="0.4">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ob3" cx="0.7" cy="0.7" r="0.35">
            <stop offset="0" stopColor="#C5B7E0" stopOpacity="0.7" />
            <stop offset="1" stopColor="#C5B7E0" stopOpacity="0" />
          </radialGradient>
          <filter id="ob4"><feGaussianBlur stdDeviation="4" /></filter>
        </defs>
        <circle cx="100" cy="100" r="96" fill="#6A8772" opacity={speaking ? 0.25 : 0.15} />
        <circle cx="100" cy="100" r="80" fill="url(#ob1)" />
        <g transform={`rotate(${rot} 100 100)`} filter="url(#ob4)">
          <ellipse cx="100" cy="65" rx="50" ry="20" fill="#B8D4C0" opacity="0.65" />
          <ellipse cx="130" cy="110" rx="40" ry="18" fill="#C5B7E0" opacity="0.55" />
          <ellipse cx="75" cy="125" rx="38" ry="16" fill="#E8C7A8" opacity="0.45" />
        </g>
        <g transform={`rotate(${-rot * 0.7} 100 100)`} filter="url(#ob4)">
          <ellipse cx="120" cy="80" rx="30" ry="14" fill="#F5F1E8" opacity="0.5" />
          <ellipse cx="80" cy="105" rx="28" ry="12" fill="#6A8772" opacity="0.35" />
        </g>
        <circle cx="100" cy="100" r="80" fill="url(#ob2)" />
        <circle cx="100" cy="100" r="80" fill="url(#ob3)" />
        <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="0.5" />
      </svg>
      {state === 'listening' && [0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '1px solid rgba(106,135,114,.4)',
          animation: `orbPulse 2.4s ${i * 0.8}s infinite ease-out`,
        }} />
      ))}
    </div>
  );
}
