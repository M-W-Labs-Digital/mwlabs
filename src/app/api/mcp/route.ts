import { NextResponse } from "next/server";

const publicInfo = {
  name: "M&W Labs",
  description: "An independent digital studio in Dhaka building websites, software, brands, marketing campaigns, content, and AI automation for teams worldwide.",
  email: "hello@mwlabs.digital",
  phone: "+44 20 3769 7100",
  location: "Demra, Dhaka, Bangladesh",
  pages: {
    home: "https://mwlabs.digital/",
    about: "https://mwlabs.digital/#about",
    services: "https://mwlabs.digital/#services",
    work: "https://mwlabs.digital/work",
    insights: "https://mwlabs.digital/blog",
    contact: "https://mwlabs.digital/contact",
    terms: "https://mwlabs.digital/terms",
  },
};

const tool = {
  name: "get_mw_labs_public_info",
  description: "Get M&W Labs public business, contact, and key page information.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

function rpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id, error: { code, message } }, { status: 400 });
}

export async function POST(request: Request) {
  let message: { id?: unknown; method?: unknown; params?: { name?: unknown } };
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const { id, method } = message;
  if (typeof method !== "string") return rpcError(id ?? null, -32600, "Invalid request");
  if (method.startsWith("notifications/")) return new Response(null, { status: 202 });
  if (id === undefined) return new Response(null, { status: 202 });

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: "2025-11-25",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "mwlabs-public-info", version: "1.0.0" },
    });
  }
  if (method === "ping") return rpcResult(id, {});
  if (method === "tools/list") return rpcResult(id, { tools: [tool] });
  if (method === "tools/call" && message.params?.name === tool.name) {
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(publicInfo) }],
      structuredContent: publicInfo,
    });
  }
  if (method === "tools/call") return rpcError(id, -32602, "Unknown tool");
  return rpcError(id, -32601, "Method not found");
}