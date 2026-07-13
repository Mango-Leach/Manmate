import { siteConfig } from '@/lib/siteConfig';
import { HomepageAuthGuard } from '@/components/interactive/HomepageAuthGuard';

export const metadata = {
  title: 'मनmate — Online Mental Health Support & Therapy in Hindi | 24/7',
  description: 'मनmate connects you with licensed therapists, trained peer listeners, and AI-powered mental wellness support — in Hindi & English. Private, affordable, and available 24/7. Start your journey to better mental health today.',
  alternates: { canonical: siteConfig.url },
  openGraph: { url: siteConfig.url },
};

export default function Page() {
  return <HomepageAuthGuard />;
}
