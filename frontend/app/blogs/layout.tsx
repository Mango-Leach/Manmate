import { siteConfig } from '@/lib/siteConfig'

export const metadata = {
  title: 'Mental Health Blog — Tips, Guides & Stories',
  description: 'Thoughtful reads on mental health, relationships, and everyday well-being — in Hindi and English. Written to help you understand yourself a little better.',
  alternates: { canonical: `${siteConfig.url}/blogs` },
  openGraph: { url: `${siteConfig.url}/blogs` },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
