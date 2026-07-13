import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'MannMate — Mental Health Support in Hindi & English'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 55%, #24243e 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: 'rgba(139,92,246,0.08)', top: -180, right: -120, display: 'flex' }} />
        <div style={{ position: 'absolute', width: 360, height: 360, borderRadius: '50%', background: 'rgba(139,92,246,0.06)', bottom: -120, left: -80, display: 'flex' }} />

        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          {/* Badge */}
          <div
            style={{
              background: 'rgba(139,92,246,0.18)',
              border: '1px solid rgba(196,181,253,0.35)',
              borderRadius: 24,
              padding: '7px 22px',
              fontSize: 17,
              color: '#c4b5fd',
              display: 'flex',
            }}
          >
            Mental Health Platform
          </div>

          {/* Brand */}
          <div style={{ fontSize: 96, fontWeight: 800, color: '#ffffff', letterSpacing: -3, display: 'flex' }}>
            MannMate
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 30,
              color: '#c4b5fd',
              textAlign: 'center',
              maxWidth: 680,
              lineHeight: 1.4,
              display: 'flex',
            }}
          >
            Mental Health Support in Hindi &amp; English
          </div>

          {/* Pills */}
          <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
            {['24/7 Available', 'Free & Confidential', 'Hindi · English'].map((label) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.09)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 18,
                  color: '#e2e8f0',
                  display: 'flex',
                }}
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer URL */}
        <div
          style={{
            position: 'absolute',
            bottom: 36,
            fontSize: 19,
            color: '#6b7280',
            display: 'flex',
          }}
        >
          mannmate.com
        </div>
      </div>
    ),
    { ...size }
  )
}
