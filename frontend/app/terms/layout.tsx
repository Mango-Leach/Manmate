import { siteConfig } from '@/lib/siteConfig'

export const metadata = {
  title: 'Terms of Service',
  description: 'Understand how मनmate works, what we promise you, and what we ask in return. Your trust is the foundation we build everything on.',
  alternates: { canonical: `${siteConfig.url}/terms` },
  openGraph: { url: `${siteConfig.url}/terms` },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
