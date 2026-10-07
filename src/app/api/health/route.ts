import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    // A reachable database can still be missing the tables used by registration.
    await db.organization.findFirst({ select: { id: true, slug: true } });
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Expose only the stable error code, never SQL, connection details or messages.
    const code = typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^P\d{4}$/.test(error.code)
      ? error.code
      : undefined;
    return Response.json({ status: "unavailable", code }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
