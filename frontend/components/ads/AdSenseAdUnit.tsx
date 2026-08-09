'use client';

import React, { useEffect, useRef } from 'react';

interface AdSenseAdUnitProps {
  slot?: string;
  format?: 'auto' | 'fluid' | 'rectangle' | 'horizontal' | 'vertical';
  responsive?: boolean;
  layoutKey?: string;
  style?: React.CSSProperties;
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: Array<Record<string, unknown>>;
  }
}

export function AdSenseAdUnit({
  slot = '1234567890',
  format = 'auto',
  responsive = true,
  layoutKey,
  style = { display: 'block', minHeight: '90px' },
  className = '',
}: AdSenseAdUnitProps) {
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-3656534810825959';
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pushedRef.current) return;

    // Small delay to ensure DOM element and script initialization
    const timer = setTimeout(() => {
      try {
        if (typeof window !== 'undefined' && window.adsbygoogle) {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
          pushedRef.current = true;
        }
      } catch (err) {
        // Silently ignore dev/placeholder AdSense push exceptions
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [slot]);

  return (
    <div
      style={{
        margin: '24px 0',
        padding: '12px 16px',
        background: 'var(--card, #FFFFFF)',
        border: '1px dashed var(--line, #E5DFC9)',
        borderRadius: 14,
        textAlign: 'center',
        overflow: 'hidden',
      }}
      className={className}
    >
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1.2, color: 'var(--muted, #7A8680)', marginBottom: 8, opacity: 0.75 }}>
        Advertisement
      </div>

      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client={publisherId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
        {...(layoutKey ? { 'data-ad-layout-key': layoutKey } : {})}
      />
    </div>
  );
}

export default AdSenseAdUnit;
