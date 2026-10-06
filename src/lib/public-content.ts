import "server-only";

import { cache } from "react";
import type { Metadata } from "next";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.BETTER_AUTH_URL?.startsWith("http") ? process.env.BETTER_AUTH_URL : undefined) ??
    "https://mwlabs.digital",
);

const publishedAtOrBeforeNow = () => ({ status: "Published", publishedAt: { lte: new Date() } });
const recoverablePrismaCodes = new Set(["P1001", "P1003", "P2021", "P2022"]);

function absoluteUrl(value: string) {
  return new URL(value, siteUrl).toString();
}

function descriptionFallback(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 160);
}

function isRecoverableContentError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && recoverablePrismaCodes.has(error.code)) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;

  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  if (typeof code === "string" && recoverablePrismaCodes.has(code)) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /TableDoesNotExist|Can't reach database server|ECONNREFUSED|pool timeout|failed to retrieve a connection/.test(message);
}

function warnContentFallback(scope: string, error: unknown) {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : undefined;
  const label = error instanceof Error ? error.name : "Unknown error";
  const detail = typeof code === "string" ? `${label} ${code}` : label;

  console.warn(
    `Public content is unavailable for ${scope}; returning fallback content. Run npm run db:push or npx prisma migrate deploy against the production database. (${detail})`,
  );
}

async function withContentFallback<T>(scope: string, query: () => Promise<T>, fallback: T) {
  try {
    return await query();
  } catch (error) {
    if (!isRecoverableContentError(error)) throw error;
    warnContentFallback(scope, error);
    return fallback;
  }
}

type SeoRecord = {
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImage: string | null;
};

export function createContentMetadata(
  record: SeoRecord,
  options: {
    pathname: string;
    description: string;
    type?: "article" | "website";
    publishedAt?: Date | null;
    noIndex?: boolean;
  },
): Metadata {
  const title = record.metaTitle || record.title;
  const description = record.metaDescription || descriptionFallback(options.description);
  const canonical = record.canonicalUrl ? absoluteUrl(record.canonicalUrl) : absoluteUrl(options.pathname);
  const images = record.ogImage ? [absoluteUrl(record.ogImage)] : undefined;

  return {
    title,
    description,
    alternates: { canonical },
    robots: options.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      type: options.type ?? "website",
      title,
      description,
      url: canonical,
      siteName: "M&W Labs",
      images,
      ...(options.type === "article" && options.publishedAt
        ? { publishedTime: options.publishedAt.toISOString() }
        : {}),
    },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export async function getHomepageContent() {
  return withContentFallback("homepage", async () => {
    const where = publishedAtOrBeforeNow();
    const [blogPosts, workPosts] = await Promise.all([
      db.blogPost.findMany({
        where,
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
        take: 3,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          category: true,
          authorName: true,
          featured: true,
          publishedAt: true,
        },
      }),
      db.workPost.findMany({
        where,
        orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
        take: 2,
        select: {
          id: true,
          title: true,
          slug: true,
          clientName: true,
          industry: true,
          summary: true,
          coverImage: true,
          featured: true,
        },
      }),
    ]);

    return { blogPosts, workPosts };
  }, { blogPosts: [], workPosts: [] });
}

export async function getPublishedBlogPosts(page = 1, pageSize = 18) {
  const limit = Math.min(48, Math.max(6, pageSize));
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;

  return withContentFallback("blog listing", async () => {
    const where = publishedAtOrBeforeNow();
    const total = await db.blogPost.count({ where });
    const pages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(requestedPage, pages);
    const posts = await db.blogPost.findMany({
      where,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      skip: (currentPage - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        category: true,
        authorName: true,
        featured: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return { posts, total, page: currentPage, pages };
  }, { posts: [], total: 0, page: 1, pages: 1 });
}

export const getPublishedBlogPost = cache(async (slug: string) => {
  return withContentFallback(`blog post ${slug}`, () => db.blogPost.findFirst({
    where: { slug, ...publishedAtOrBeforeNow() },
  }), null);
});

export async function getPublishedWorkPosts(page = 1, pageSize = 12) {
  const limit = Math.min(36, Math.max(4, pageSize));
  const requestedPage = Number.isSafeInteger(page) && page > 0 ? page : 1;

  return withContentFallback("work listing", async () => {
    const where = publishedAtOrBeforeNow();
    const total = await db.workPost.count({ where });
    const pages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(requestedPage, pages);
    const posts = await db.workPost.findMany({
      where,
      orderBy: [{ featured: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
      skip: (currentPage - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        clientName: true,
        industry: true,
        services: true,
        summary: true,
        coverImage: true,
        featured: true,
        completedAt: true,
        publishedAt: true,
        updatedAt: true,
      },
    });
    return { posts, total, page: currentPage, pages };
  }, { posts: [], total: 0, page: 1, pages: 1 });
}

export const getPublishedWorkPost = cache(async (slug: string) => {
  return withContentFallback(`work post ${slug}`, () => db.workPost.findFirst({
    where: { slug, ...publishedAtOrBeforeNow() },
  }), null);
});

export const getPublishedSeoPage = cache(async (slug: string) => {
  return withContentFallback(`SEO page ${slug}`, () => db.seoPage.findFirst({
    where: { slug, ...publishedAtOrBeforeNow() },
  }), null);
});

export async function getSitemapCounts() {
  const where = publishedAtOrBeforeNow();
  const [blogPosts, workPosts, seoPages] = await Promise.all([
    db.blogPost.count({ where }),
    db.workPost.count({ where }),
    db.seoPage.count({ where: { ...where, noIndex: false } }),
  ]);
  return { blogPosts, workPosts, seoPages };
}

export async function getSitemapContent(offset = 0, limit = 45_000) {
  const where = publishedAtOrBeforeNow();
  const counts = await getSitemapCounts();
  let remainingOffset = Math.max(0, offset);
  let remainingLimit = Math.min(45_000, Math.max(1, limit));

  const blogSkip = Math.min(remainingOffset, counts.blogPosts);
  remainingOffset -= blogSkip;
  const blogTake = Math.min(remainingLimit, Math.max(0, counts.blogPosts - blogSkip));
  remainingLimit -= blogTake;

  const workSkip = Math.min(remainingOffset, counts.workPosts);
  remainingOffset -= workSkip;
  const workTake = Math.min(remainingLimit, Math.max(0, counts.workPosts - workSkip));
  remainingLimit -= workTake;

  const seoSkip = Math.min(remainingOffset, counts.seoPages);
  const seoTake = Math.min(remainingLimit, Math.max(0, counts.seoPages - seoSkip));

  const [blogPosts, workPosts, seoPages] = await Promise.all([
    blogTake ? db.blogPost.findMany({ where, orderBy: { id: "asc" }, skip: blogSkip, take: blogTake, select: { slug: true, updatedAt: true } }) : [],
    workTake ? db.workPost.findMany({ where, orderBy: { id: "asc" }, skip: workSkip, take: workTake, select: { slug: true, updatedAt: true } }) : [],
    seoTake ? db.seoPage.findMany({ where: { ...where, noIndex: false }, orderBy: { id: "asc" }, skip: seoSkip, take: seoTake, select: { slug: true, updatedAt: true } }) : [],
  ]);
  return { blogPosts, workPosts, seoPages };
}
