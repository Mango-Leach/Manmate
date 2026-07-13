import { siteConfig } from '@/lib/siteConfig'

export const metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the मनmate team — general support, privacy enquiries, and partnerships.',
  alternates: { canonical: `${siteConfig.url}/contact` },
  openGraph: { url: `${siteConfig.url}/contact` },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
