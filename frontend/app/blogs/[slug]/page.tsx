import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { siteConfig } from '@/lib/siteConfig';
import { POSTS } from '@/lib/blogPosts';
import { BlogHeader } from '@/components/design/BlogHeader';

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function generateStaticParams() {
  return POSTS.map(post => ({ slug: post.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = POSTS.find(p => p.slug === params.slug);
  if (!post) return {};

  const url = `${siteConfig.url}/blogs/${post.slug}`;

  return {
    title: post.title,
    description: post.excerpt,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.excerpt,
      images: [{ url: post.imageUrl }],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: [post.imageUrl],
    },
  };
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = POSTS.find(p => p.slug === params.slug);
  if (!post) notFound();

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <BlogHeader />

      <main style={{
        maxWidth: 680,
        margin: '0 auto',
        padding: 'clamp(40px, 8vw, 80px) clamp(20px, 5vw, 48px)',
        width: '100%',
      }}>
        <Link href="/blogs" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 999, padding: '6px 14px', textDecoration: 'none', marginBottom: 40 }}>
          <ArrowLeft /> Back to Blogs
        </Link>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--muted)', padding: '4px 12px', borderRadius: 999, border: '1px solid var(--line)', background: 'var(--bg-2)', marginBottom: 20 }}>
          {post.category} <span style={{ opacity: 0.7, fontSize: 9 }}>{post.categoryHi}</span>
        </div>

        <h1 className="serif" style={{ fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 400, lineHeight: 1.2, color: 'var(--ink)', margin: '0 0 16px', letterSpacing: -0.02 }}>
          {post.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, color: 'var(--muted)', fontSize: 13, marginBottom: 40 }}>
          <span style={{ fontWeight: 600 }}>By {post.author}</span>
          <span>·</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><ClockIcon /> {post.readTime} min read</span>
          <span>·</span>
          <span>{post.date}</span>
        </div>

        <div style={{ width: '100%', height: '300px', borderRadius: 16, overflow: 'hidden', marginBottom: 40 }}>
          <img src={post.imageUrl} alt={post.imageAlt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ width: 48, height: 1, background: 'var(--line)', marginBottom: 40 }} />

        <p style={{ fontSize: 18, color: 'var(--ink-2)', lineHeight: 1.75, fontStyle: 'italic', margin: '0 0 40px', paddingLeft: 20, borderLeft: '3px solid var(--line)' }}>
          {post.excerpt}
        </p>

        {post.sections.map((s, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            {s.heading && (
              <h2 style={{ fontSize: 19, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px', fontFamily: 'Geist, sans-serif' }}>
                {s.heading}
              </h2>
            )}
            <p style={{ fontSize: 16, color: 'var(--ink-2)', lineHeight: 1.8, margin: 0 }}>
              {s.body}
            </p>
          </div>
        ))}

        <div style={{ margin: '48px 0', padding: '28px 32px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 12, borderLeft: `4px solid ${post.color}` }}>
          <p style={{ margin: 0, fontSize: 18, fontStyle: 'italic', color: 'var(--ink)', lineHeight: 1.6, fontFamily: 'Georgia, serif' }}>
            &ldquo;{post.quote}&rdquo;
          </p>
        </div>

        <div style={{ marginTop: 48, padding: '32px', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 16, textAlign: 'center' }}>
          <p style={{ margin: '0 0 16px', fontSize: 15, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            If you found this helpful and want to talk to someone, MannMate is available 24/7 — free and confidential.
          </p>
          <a href="/chat" style={{ display: 'inline-block', padding: '10px 24px', background: 'var(--ink)', color: 'var(--bg)', borderRadius: 999, fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
            Talk to MannMate
          </a>
        </div>
      </main>
    </div>
  );
}
