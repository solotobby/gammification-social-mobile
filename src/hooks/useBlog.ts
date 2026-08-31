import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { fetchBlog, fetchBlogs } from '../api/blog';

/**
 * GET /blogs — the paginated story list.
 *
 * Unlike the rest of the app's queries this one is **not** gated on a token:
 * the endpoint is public, and the blog is the one screen worth reading before
 * signing in.
 */
export function useBlogs() {
  return useInfiniteQuery({
    queryKey: ['blogs'],
    queryFn: ({ pageParam }) => fetchBlogs(pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.next_page_url ? last.current_page + 1 : undefined),
  });
}

/** GET /blogs/{slug} — one story, for the detail screen. */
export function useBlogPost(slug: string | undefined) {
  return useQuery({
    queryKey: ['blog', slug],
    queryFn: () => fetchBlog(slug!),
    enabled: !!slug,
  });
}
