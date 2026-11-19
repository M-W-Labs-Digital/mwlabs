import { generateSitemaps } from "@/app/sitemaps/sitemap";
import { siteUrl } from "@/lib/public-content";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
  })[character]!);
}

export async function GET() {
  const sitemaps = await generateSitemaps();
  const entries = sitemaps.map(({ id }) =>
    `<sitemap><loc>${escapeXml(new URL(`/sitemaps/sitemap/${id}.xml`, siteUrl).toString())}</loc></sitemap>`,
  ).join("");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
}
