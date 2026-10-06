import type { MetadataRoute } from "next";
import { notFound } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { getSitemapContent, getSitemapCounts, siteUrl } from "@/lib/public-content";

export const dynamic = "force-dynamic";

const sitemapSize = 45_000;
const recoverablePrismaCodes = new Set(["P1001", "P1003", "P2021", "P2022"]);
const staticRoutes = [
  { pathname: "/", changeFrequency: "weekly", priority: 1 },
  { pathname: "/blog", changeFrequency: "weekly", priority: 0.8 },
  { pathname: "/work", changeFrequency: "monthly", priority: 0.8 },
] as const;

function staticSitemapEntries(): MetadataRoute.Sitemap {
  return staticRoutes.map((route) => ({
    url: new URL(route.pathname, siteUrl).toString(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}

function isRecoverableSitemapError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && recoverablePrismaCodes.has(error.code)) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;

  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  if (typeof code === "string" && recoverablePrismaCodes.has(code)) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /TableDoesNotExist|Can't reach database server|ECONNREFUSED|pool timeout|failed to retrieve a connection/.test(message);
}

function warnSitemapFallback(error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  const label = error instanceof Error ? error.name : "Unknown error";
  const detail = typeof code === "string" ? `${label} ${code}` : label;

  console.warn(
    `Sitemap database content is unavailable; returning static sitemap entries. Run npm run db:push or npm run db:migrate before building/deploying the full sitemap. (${detail})`,
  );
}

export async function generateSitemaps() {
  let counts: Awaited<ReturnType<typeof getSitemapCounts>>;

  try {
    counts = await getSitemapCounts();
  } catch (error) {
    if (!isRecoverableSitemapError(error)) throw error;
    warnSitemapFallback(error);
    return [{ id: 0 }];
  }

  const total = counts.blogPosts + counts.workPosts + counts.seoPages;
  return Array.from({ length: Math.max(1, Math.ceil(total / sitemapSize)) }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const value = await id;
  const sitemapId = Number(value);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(sitemapId)) notFound();
  let content: Awaited<ReturnType<typeof getSitemapContent>>;

  try {
    content = await getSitemapContent(sitemapId * sitemapSize, sitemapSize);
  } catch (error) {
    if (!isRecoverableSitemapError(error)) throw error;
    warnSitemapFallback(error);
    return sitemapId === 0 ? staticSitemapEntries() : [];
  }

  const { blogPosts, workPosts, seoPages } = content;

  return [
    ...(sitemapId === 0 ? staticSitemapEntries() : []),
    ...blogPosts.map((post) => ({
      url: new URL(`/blog/${post.slug}`, siteUrl).toString(),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...workPosts.map((post) => ({
      url: new URL(`/work/${post.slug}`, siteUrl).toString(),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...seoPages.map((page) => ({
      url: new URL(`/${page.slug}`, siteUrl).toString(),
      lastModified: page.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
