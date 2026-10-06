import { db } from "@/lib/db";
import { requireApiSession } from "@/lib/dal";
import { isWorkspaceAdmin } from "@/lib/permissions";

export async function GET(request: Request) {
  const session = await requireApiSession(request);
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const invitationScope = { organizationId: session.organizationId, status: "pending", ...(!isWorkspaceAdmin(session.role) ? { id: { in: [] as string[] } } : {}) };

  const [members, invitations, teams, memberTotal, invitationTotal, teamTotal] = await Promise.all([
    db.member.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "asc" },
      take: 250,
      select: {
        id: true,
        userId: true,
        role: true,
        createdAt: true,
        user: { select: { name: true, email: true, image: true } },
      },
    }),
    db.invitation.findMany({
      where: invitationScope,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, email: true, role: true, status: true, expiresAt: true, createdAt: true },
    }),
    db.team.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { name: "asc" },
      take: 100,
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { members: true } },
      },
    }),
    db.member.count({ where: { organizationId: session.organizationId } }),
    db.invitation.count({ where: invitationScope }),
    db.team.count({ where: { organizationId: session.organizationId } }),
  ]);

  return Response.json({
    currentUserId: session.userId,
    currentRole: session.role,
    organizationId: session.organizationId,
    emailProviderConfigured: Boolean(process.env.RESEND_API_KEY && process.env.NOTIFICATION_EMAIL_FROM),
    totals: { members: memberTotal, invitations: invitationTotal, teams: teamTotal },
    members: members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
      name: member.user.name,
      email: member.user.email,
      image: member.user.image,
    })),
    invitations: invitations.map((invitation) => ({
      ...invitation,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    })),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      memberCount: team._count.members,
      createdAt: team.createdAt.toISOString(),
    })),
  }, { headers: { "Cache-Control": "no-store" } });
}
