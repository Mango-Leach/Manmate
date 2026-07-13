import { siteConfig } from '@/lib/siteConfig'

export const metadata = {
  title: 'Community — Connect & Share',
  description: 'You are not alone. Join a community of people navigating the same journey — share openly, listen with empathy, and grow together.',
  alternates: { canonical: `${siteConfig.url}/community` },
  openGraph: { url: `${siteConfig.url}/community` },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
