"use client";

import { useEffect } from "react";

type PublicBusinessInfo = {
  name: string;
  description: string;
  email: string;
  phone: string;
  location: string;
  pages: Record<string, string>;
};

type ModelContext = {
  registerTool: (tool: {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: () => PublicBusinessInfo;
  }) => void;
};

const businessInfo: PublicBusinessInfo = {
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

export function WebMcpTools() {
  useEffect(() => {
    const modelContext = (navigator as Navigator & { modelContext?: ModelContext }).modelContext;
    modelContext?.registerTool({
      name: "get_mw_labs_public_info",
      description: "Get M&W Labs public business, contact, and key page information.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      execute: () => businessInfo,
    });
  }, []);

  return null;
}