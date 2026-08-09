import { siteConfig } from '@/lib/siteConfig'
import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: 'मनmate — Online Therapy & Mental Health Support in Hindi & English',
    template: '%s | मनmate',
  },
  description: 'मनmate offers professional mental health support through licensed therapists, peer listeners & AI wellness tools — in Hindi & English. Confidential, affordable & available 24/7. No appointments needed.',
  openGraph: {
    type: 'website',
    locale: 'hi_IN',
    url: siteConfig.url,
    siteName: siteConfig.name,
    title: 'मनmate — Online Therapy & Mental Health Support in Hindi & English',
    description: 'Professional mental health support through licensed therapists, peer listeners & AI wellness tools — in Hindi & English. Confidential & available 24/7.',
    images: [
      {
        url: '/og-image.png', // relative — resolves via metadataBase
        width: 1200,
        height: 630,
        alt: 'मनmate',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'मनmate — Online Therapy & Mental Health Support in Hindi & English',
    description: 'Professional mental health support through licensed therapists, peer listeners & AI wellness tools — in Hindi & English. Confidential & available 24/7.',
    images: ['/og-image.png'],
  },
  alternates: {
    canonical: siteConfig.url,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: [
      { url: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/logo-192.png',
    apple: [{ url: '/logo-192.png', sizes: '192x192', type: 'image/png' }],
  },
  manifest: '/site.webmanifest',
  // TODO: Replace og-image.png with real designed OG image before launch
};

import GoogleAdSense from '@/components/ads/GoogleAdSense';
import CookieConsent from '@/components/consent/CookieConsent';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="google-adsense-account" content="ca-pub-3656534810825959" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=Geist:wght@300;400;500;600&family=Noto+Sans+Devanagari:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <GoogleAdSense />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SLL5HGM34R"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SLL5HGM34R');
          `}
        </Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": siteConfig.name,
              "url": siteConfig.url,
              "description": siteConfig.description,
              "areaServed": "IN",
              "availableLanguage": ["English", "Hindi"]
            })
          }}
        />
        {/* TODO: Add potentialAction SearchAction when real domain is confirmed */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": siteConfig.name,
              "url": siteConfig.url
            })
          }}
        />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
