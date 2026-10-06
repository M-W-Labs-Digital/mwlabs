import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AiConcierge } from "@/components/ai/ai-concierge";
import { getWorkspaceContext } from "@/lib/dal";
import { isGeminiConfigured } from "@/lib/gemini";
import { canAccessModule } from "@/lib/permissions";

export const metadata: Metadata = { title: "M&W Intelligence" };

export default async function AiPage() {
  const context = await getWorkspaceContext();
  if (!canAccessModule(context.role, "ai")) redirect("/app");
  return (
    <AiConcierge
      organizationName={context.organization.name}
      userName={context.user.name}
      geminiEnabled={isGeminiConfigured()}
    />
  );
}
