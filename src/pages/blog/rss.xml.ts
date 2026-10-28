// /blog/rss.xml — feed RSS 2.0 artikel terbaru. Dipakai pembaca RSS, agregator,
// dan crawler yang memantau konten baru (selain sitemap).
import type { APIRoute } from 'astro';
import { getBlog } from '@/lib/blog/sanity';
import { canonicalUrl, postPath } from '@/lib/blog/model';
import { escapeHtml, sanityImageUrl } from '@/lib/blog/markdown';
import { site } from '@data/site';

export const GET: APIRoute = async () => {
  const blog = await getBlog();
  const abs = (p: string) => canonicalUrl(site.url, p);
  const items = blog.posts
    .filter((p) => !p.seo.noindex)
    .slice(0, 30)
    .map((p) => {
      const link = abs(postPath(p.slug));
      const img = p.mainImage
        ? `\n      <enclosure url="${escapeHtml(sanityImageUrl(p.mainImage.url, { w: 1200, h: 630, fit: 'crop', fm: 'jpg' }))}" type="image/jpeg" length="0" />`
        : '';
      const cats = p.categories.map((c) => `\n      <category>${escapeHtml(c.title)}</category>`).join('');
      return `
    <item>
      <title>${escapeHtml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${escapeHtml(p.id)}</guid>
      <pubDate>${new Date(p.publishedAt).toUTCString()}</pubDate>
      <description>${escapeHtml(p.seo.description || p.excerpt)}</description>${p.author ? `\n      <dc:creator>${escapeHtml(p.author.name)}</dc:creator>` : ''}${cats}${img}
    </item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Blog ${escapeHtml(site.name)}</title>
    <link>${abs('/blog')}</link>
    <description>Tips, panduan, dan cerita di balik produk ${escapeHtml(site.name)}.</description>
    <language>id-ID</language>
    <atom:link href="${abs('/blog/rss.xml')}" rel="self" type="application/rss+xml" />${blog.posts[0] ? `\n    <lastBuildDate>${new Date(blog.posts[0].updatedAt).toUTCString()}</lastBuildDate>` : ''}${items}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
