'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BlogHeader } from '@/components/design/BlogHeader';
import { POSTS, ALL_CATEGORIES, type BlogPost } from '@/lib/blogPosts';

// ─── SVG Icons ────────────────────────────────────────────────────────────────

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 3.5V6l1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

// ─── PostCard (Horizontal Layout with Image) ──────────────────────────────────

function PostCard({ post }: { post: BlogPost }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={`/blogs/${post.slug}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: hovered
          ? '0 8px 32px rgba(0,0,0,0.08)'
          : '0 1px 4px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        height: '180px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{
        width: '160px',
        flexShrink: 0,
        position: 'relative',
        borderRight: '1px solid var(--line)'
      }}>
        <img
          src={post.imageUrl}
          alt={post.imageAlt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: 4, background: post.color, opacity: 0.8
        }} />
      </div>

      <div style={{ padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: 1,
            textTransform: 'uppercase', color: 'var(--muted)',
            padding: '3px 10px', borderRadius: 999,
            border: '1px solid var(--line)',
            background: 'var(--bg-2)',
          }}>
            {post.category}
          </span>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Geist, monospace' }}>
            {post.date}
          </span>
        </div>

        <h2 style={{
          margin: '0 0 6px 0',
          fontSize: 16, fontWeight: 600,
          lineHeight: 1.3, color: 'var(--ink)',
          fontFamily: 'Georgia, serif',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {post.title}
        </h2>

        <p style={{
          margin: 0,
          fontSize: 13, color: 'var(--ink-2)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          flex: 1
        }}>
          {post.excerpt}
        </p>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 12, borderTop: '1px solid var(--line)',
          marginTop: 'auto',
        }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
            {post.author}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 11 }}>
            <ClockIcon />
            <span>{post.readTime} min read</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Blog Index ───────────────────────────────────────────────────────────────

function BlogIndex() {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? POSTS
    : POSTS.filter(p => p.category === activeCategory);

  return (
    <main style={{
      flex: 1,
      padding: 'clamp(40px, 8vw, 72px) clamp(20px, 5vw, 48px)',
      maxWidth: 1100, margin: '0 auto', width: '100%',
    }}>
      <div style={{ marginBottom: 56, animation: 'fadeUp 0.5s both' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999, background: 'var(--bg-2)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20, border: '1px solid var(--line)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage-soft)', opacity: 0.8 }} />
          ब्लॉग
        </div>
        <h1 className="serif" style={{ fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 400, lineHeight: 1.0, letterSpacing: -0.025, margin: '0 0 16px', color: 'var(--ink)' }}>
          Blogs
        </h1>
        <p style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: 480, margin: 0 }}>
          Stories, guides, and expert insights on mental health — written with care, in Hindi and English.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 40, animation: 'fadeUp 0.55s both' }}>
        {ALL_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{ padding: '7px 16px', borderRadius: 999, border: '1px solid', borderColor: activeCategory === cat ? 'var(--ink)' : 'var(--line)', background: activeCategory === cat ? 'var(--ink)' : 'var(--card)', color: activeCategory === cat ? 'var(--bg)' : 'var(--ink-2)', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s ease', fontFamily: 'Geist, sans-serif' }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(450px, 1fr))',
        gap: 24,
        animation: 'fadeUp 0.6s both',
      }}>
        {filtered.map(post => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      <p style={{ marginTop: 48, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>
        Showing {filtered.length} of {POSTS.length} articles
      </p>
    </main>
  );
}

// ─── Page Shell ───────────────────────────────────────────────────────────────

export default function BlogsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <BlogHeader />

      <div aria-hidden="true" style={{ position: 'fixed', top: -180, left: -80, width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(closest-side, var(--sage-soft), transparent 70%)', opacity: 0.35, pointerEvents: 'none', zIndex: 0 }} />
      <div aria-hidden="true" style={{ position: 'fixed', bottom: -200, right: -120, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(closest-side, var(--lavender-soft), transparent 70%)', opacity: 0.35, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column' }}>
        {mounted ? (
          <BlogIndex />
        ) : (
          <main style={{
            flex: 1,
            padding: 'clamp(40px, 8vw, 72px) clamp(20px, 5vw, 48px)',
            maxWidth: 1100, margin: '0 auto', width: '100%',
          }}>
            {/* Matching structural skeleton layout for SEO optimization */}
            <div style={{ marginBottom: 56 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', borderRadius: 999, background: 'var(--bg-2)', color: 'var(--muted)', fontSize: 11, fontWeight: 600, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 20, border: '1px solid var(--line)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--sage-soft)', opacity: 0.8 }} />
                ब्लॉग
              </div>
              <h1 className="serif" style={{ fontSize: 'clamp(40px, 8vw, 72px)', fontWeight: 400, lineHeight: 1.0, letterSpacing: -0.025, margin: '0 0 16px', color: 'var(--ink)' }}>
                Blogs
              </h1>
              <p style={{ fontSize: 17, color: 'var(--ink-2)', lineHeight: 1.65, maxWidth: 480, margin: 0 }}>
                Stories, guides, and expert insights on mental health — written with care, in Hindi and English.
              </p>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
