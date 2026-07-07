import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@proven-power/shared-types";

const WP_BASE = "https://provenpower.com/wp-json/wp/v2";
const EXTERNAL_SOURCE = "wordpress";

interface WpPost {
  id: number;
  date: string;
  modified: string;
  link: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  featured_media: number;
  status: string;
}

interface WpMedia {
  source_url: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WordPressSyncResult {
  fetched: number;
  upserted: number;
  errors: string[];
  diagnostic?: string;
}

export async function syncWordPressPosts(
  supabase: SupabaseClient<Database>
): Promise<WordPressSyncResult> {
  // Fetch recent published posts — 20 is plenty for a dealer blog
  const res = await fetch(
    `${WP_BASE}/posts?per_page=20&orderby=date&order=desc&status=publish&_fields=id,date,modified,link,title,excerpt,content,featured_media`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    return { fetched: 0, upserted: 0, errors: [], diagnostic: `WordPress API returned HTTP ${res.status} — check that ${WP_BASE}/posts is accessible` };
  }

  const posts = (await res.json()) as WpPost[];

  if (!Array.isArray(posts)) {
    return { fetched: 0, upserted: 0, errors: [], diagnostic: "WordPress API did not return an array of posts" };
  }

  // Batch-fetch featured images for posts that have one
  const mediaIds = [...new Set(posts.filter((p) => p.featured_media).map((p) => p.featured_media))];
  const imageUrlById = new Map<number, string>();
  if (mediaIds.length > 0) {
    try {
      const mediaRes = await fetch(`${WP_BASE}/media?include=${mediaIds.join(",")}&_fields=id,source_url`, { cache: "no-store" });
      if (mediaRes.ok) {
        const mediaItems = (await mediaRes.json()) as (WpMedia & { id: number })[];
        if (Array.isArray(mediaItems)) {
          for (const m of mediaItems) imageUrlById.set(m.id, m.source_url);
        }
      }
    } catch {
      // Non-fatal — just skip images
    }
  }

  const errors: string[] = [];
  let upserted = 0;

  for (const post of posts) {
    try {
      const title = stripHtml(post.title.rendered);
      const body = stripHtml(post.excerpt.rendered) || stripHtml(post.content.rendered).slice(0, 500);
      const imageUrl = post.featured_media ? (imageUrlById.get(post.featured_media) ?? null) : null;
      const publishedAt = new Date(post.date).toISOString();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from("promotions")
        .upsert(
          {
            external_source: EXTERNAL_SOURCE,
            external_id: String(post.id),
            external_url: post.link,
            title,
            body,
            image_url: imageUrl,
            is_active: true,
            starts_at: publishedAt,
            ends_at: null,
          },
          { onConflict: "external_source,external_id" }
        );

      if (error) {
        errors.push(`Post ${post.id}: ${(error as { message: string }).message}`);
      } else {
        upserted++;
      }
    } catch (err) {
      errors.push(`Post ${post.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { fetched: posts.length, upserted, errors };
}
