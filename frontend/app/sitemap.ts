import type { MetadataRoute } from "next";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/events`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/auth/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/auth/register`, changeFrequency: "monthly", priority: 0.3 },
  ];

  try {
    const res = await fetch(`${API_URL}/events?per_page=100`, { next: { revalidate: 3600 } });
    const body = await res.json();
    if (!body.success || !Array.isArray(body.data)) return staticPages;

    const eventPages: MetadataRoute.Sitemap = body.data.map(
      (e: { slug: string; starts_at?: string }) => ({
        url: `${SITE_URL}/events/${e.slug}`,
        lastModified: e.starts_at ? new Date(e.starts_at) : new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })
    );
    return [...staticPages, ...eventPages];
  } catch {
    return staticPages;
  }
}
