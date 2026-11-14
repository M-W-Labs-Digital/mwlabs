import { NextResponse } from "next/server";

export function GET() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mwlabs.digital";

  return NextResponse.json({
    version: "1.0",
    protocolVersion: "2025-11-25",
    serverInfo: { name: "mwlabs-public-info", title: "M&W Labs Public Information", version: "1.0.0" },
    name: "M&W Labs Public Information",
    description: "Read-only public information about M&W Labs, its services, and contact routes.",
    endpoint: `${origin}/api/mcp`,
    transport: { type: "streamable-http", url: `${origin}/api/mcp` },
    capabilities: { tools: { listChanged: false } },
  });
}