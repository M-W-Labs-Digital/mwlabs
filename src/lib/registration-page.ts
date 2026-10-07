import "server-only";

import { getCurrentAuthSession } from "@/lib/dal";
import { db } from "@/lib/db";

export async function getRegistrationPageState(newRequest = false) {
  try {
    const [session, workspace] = await Promise.all([
      getCurrentAuthSession(),
      db.organization.findUnique({ where: { slug: "mw-labs" }, select: { id: true } }),
    ]);
    if (!session?.user?.id) {
      return { status: "form", workspaceReady: Boolean(workspace), profileOnly: false } as const;
    }
    const [membership, lead, user] = await Promise.all([
      db.member.findFirst({ where: { userId: session.user.id }, select: { id: true } }),
      db.lead.findFirst({ where: { userId: session.user.id }, select: { id: true } }),
      db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, company: true, phone: true, serviceInterest: true, budgetRange: true, projectBrief: true },
      }),
    ]);
    if (membership || (lead && !newRequest)) return { status: "redirect", destination: "/app" } as const;
    return {
      status: "form",
      profileOnly: true,
      workspaceReady: Boolean(workspace),
      newRequest,
      defaults: {
        name: user?.name ?? session.user.name,
        email: user?.email ?? session.user.email,
        company: user?.company ?? undefined,
        phone: user?.phone ?? undefined,
        serviceInterest: user?.serviceInterest ?? undefined,
        budgetRange: user?.budgetRange ?? undefined,
        projectBrief: user?.projectBrief ?? undefined,
      },
    } as const;
  } catch (error) {
    console.error("Registration page lookup failed", error);
    return { status: "unavailable" } as const;
  }
}
