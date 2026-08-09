'use client';

import Script from 'next/script';

interface GoogleAdSenseProps {
  publisherId?: string;
}

export function GoogleAdSense({ publisherId }: GoogleAdSenseProps) {
  const client = publisherId || process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-3656534810825959';

  if (!client) return null;

  return (
    <Script
      id="google-adsense"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

export default GoogleAdSense;
