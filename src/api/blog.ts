import { api } from './client';
import type { ApiBlogPost, ApiEnvelope, Paginated } from './types';

/**
 * GET /blogs — the published stories, as a Laravel paginator.
 *
 * Public: it answers 200 without an Authorization header, so the screens don't
 * gate on a session.
 */
export async function fetchBlogs(page = 1): Promise<Paginated<ApiBlogPost>> {
  const { data } = await api.get<ApiEnvelope<Paginated<ApiBlogPost>>>('/blogs', {
    params: { page },
  });
  return data.data;
}

/** GET /blogs/{slug} — one story. 404s with `{success:false, message:"Blog not found"}`. */
export async function fetchBlog(slug: string): Promise<ApiBlogPost> {
  const { data } = await api.get<ApiEnvelope<ApiBlogPost>>(`/blogs/${slug}`);
  return data.data;
}

// ---------------------------------------------------------------------------
// API → view-model mapping
// ---------------------------------------------------------------------------

/** The shape the blog screens render. */
export type BlogPost = {
  /** Route key for /blog/[slug]; falls back to the id when no slug is sent. */
  slug: string;
  title: string;
  excerpt: string;
  /** Full story text, tags stripped. Empty when the list row omits it. */
  body: string;
  category: string;
  /** Cover image URL, if the story has one. */
  image?: string;
  /** Pre-formatted publish date, or '' when the API sends none. */
  date: string;
  readMinutes: number;
};

/** Rich-text fields arrive as HTML; the app has no HTML renderer, so flatten. */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** "Jun 24, 2026" from any parseable timestamp; '' when there isn't one. */
function formatDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** ~200 words a minute, floored at 1 so a short story never reads "0 min". */
function readingTime(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * One API row → the render shape.
 *
 * The endpoint has been empty on every environment so far, so this reads a few
 * plausible spellings per field instead of betting on one. Once real content
 * lands, narrow it to what the backend actually sends.
 */
export function toBlogPost(row: ApiBlogPost): BlogPost {
  const rawBody = row.body ?? row.content ?? '';
  const body = stripHtml(String(rawBody));
  const rawExcerpt = row.excerpt ?? row.summary ?? row.description ?? '';
  const excerpt = stripHtml(String(rawExcerpt)) || body.slice(0, 180);

  const category =
    typeof row.category === 'string'
      ? row.category
      : row.category?.name ?? row.category?.title ?? 'Payhankey';

  const read = Number(row.read_time ?? row.read_minutes);

  return {
    slug: String(row.slug ?? row.id ?? ''),
    title: row.title ?? 'Untitled',
    excerpt,
    body,
    category,
    image:
      row.image ?? row.cover_image ?? row.featured_image ?? row.banner ?? row.thumbnail ?? undefined,
    date: formatDate(row.published_at ?? row.created_at ?? row.date),
    readMinutes: Number.isFinite(read) && read > 0 ? Math.round(read) : readingTime(body || excerpt),
  };
}
