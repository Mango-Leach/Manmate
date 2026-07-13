import { siteConfig } from '@/lib/siteConfig'

export const metadata = {
  title: 'Talk to a Therapist Online — Hindi & English Support',
  description: 'Find a therapist who truly understands you. Browse qualified professionals for private, confidential sessions — in Hindi and English, on your schedule.',
  alternates: { canonical: `${siteConfig.url}/therapists` },
  openGraph: { url: `${siteConfig.url}/therapists` },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
