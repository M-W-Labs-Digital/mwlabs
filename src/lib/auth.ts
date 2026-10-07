import "server-only";

import { prismaAdapter } from "@better-auth/prisma-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { organization } from "better-auth/plugins";
import { z } from "zod";

import { promoteUserToStaff } from "@/lib/account-upgrade";
import { getAuthConfig } from "@/lib/auth-config";
import { authCookiePrefix } from "@/lib/auth-shared";
import { db } from "@/lib/db";
import { notificationEmailTemplate, sendEmail } from "@/lib/email";
import { notifyOrganization, queueWorkflowEmail } from "@/lib/notifications";
import { ensureSchedulingDefaults } from "@/lib/scheduling";
import { seedWorkspace } from "@/lib/seed-workspace";

const googleEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

async function sendAuthEmail({
  to,
  recipientName,
  subject,
  message,
  actionLabel,
  actionUrl,
  idempotencyKey,
}: {
  to: string;
  recipientName: string;
  subject: string;
  message: string;
  actionLabel: string;
  actionUrl: string;
  idempotencyKey: string;
}) {
  const content = notificationEmailTemplate({
    recipientName,
    title: subject,
    message,
    actionLabel,
    actionUrl,
  });
  const result = await sendEmail({
    to,
    subject: `M&W Command: ${subject}`,
    ...content,
    idempotencyKey,
  });
  if (result.status === "Failed") console.error(`Could not send ${subject.toLowerCase()} email`, result.error);
}

async function recordOrganizationActivity({ organizationId, actorId, action, resource, resourceId, title, message }: { organizationId: string; actorId?: string | null; action: string; resource: string; resourceId?: string | null; title: string; message: string }) {
  try {
    await db.auditLog.create({ data: { organizationId, userId: actorId || null, action, resource, resourceId: resourceId || null } });
    await notifyOrganization({ organizationId, actorId, category: "system", type: action, title, message, actionUrl: "/app/team", resource, resourceId });
  } catch (error) {
    console.error(`Could not record ${action}`, error);
  }
}

export const auth = betterAuth({
  appName: "M&W Command",
  ...getAuthConfig(),
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "mysql" }),
  user: {
    additionalFields: {
      accountType: {
        type: "string",
        required: true,
        input: false,
        returned: false,
        defaultValue: "prospect",
      },
      company: {
        type: "string",
        required: false,
        returned: false,
        validator: { input: z.string().trim().max(160) },
      },
      phone: {
        type: "string",
        required: false,
        returned: false,
        validator: { input: z.string().trim().max(40) },
      },
      serviceInterest: {
        type: "string",
        required: false,
        returned: false,
        validator: { input: z.string().trim().max(120) },
      },
      budgetRange: {
        type: "string",
        required: false,
        returned: false,
        validator: { input: z.string().trim().max(80) },
      },
      projectBrief: {
        type: "string",
        required: false,
        returned: false,
        validator: { input: z.string().trim().max(4_000) },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Public accounts are prospects only. Agency access still requires an
    // explicit organization membership and is enforced independently.
    disableSignUp: false,
    autoSignIn: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url, token }) => {
      await sendAuthEmail({
        to: user.email,
        recipientName: user.name,
        subject: "Reset your password",
        message: "A password reset was requested for your account. This link expires in one hour and can only be used once.",
        actionLabel: "Reset password",
        actionUrl: url,
        idempotencyKey: `auth-password-reset-${token}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url, token }) => {
      await sendAuthEmail({
        to: user.email,
        recipientName: user.name,
        subject: "Verify your email",
        message: "Confirm your email address to keep your M&W Command account secure.",
        actionLabel: "Verify email",
        actionUrl: url,
        idempotencyKey: `auth-email-verification-${token}`,
      });
    },
  },
  socialProviders: googleEnabled
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : undefined,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: authCookiePrefix,
    database: { generateId: () => crypto.randomUUID() },
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: process.env.ALLOW_INITIAL_SIGNUP === "true",
      teams: {
        enabled: true,
        defaultTeam: { enabled: true },
        maximumTeams: 20,
      },
      invitationExpiresIn: 60 * 60 * 48,
      requireEmailVerificationOnInvitation: false,
      sendInvitationEmail: async ({ id, email, organization: invitedOrganization, inviter }) => {
        const title = `Join ${invitedOrganization.name} in M&W Command`;
        const message = `${inviter.user.name} invited you to collaborate in the ${invitedOrganization.name} agency workspace. This invitation expires in 48 hours.`;
        await queueWorkflowEmail({
          organizationId: invitedOrganization.id,
          to: email,
          recipientName: null,
          title,
          message,
          actionLabel: "Accept invitation",
          actionUrl: `/invite/${encodeURIComponent(id)}`,
          idempotencyKey: `organization-invitation-${id}`,
        });
      },
      organizationHooks: {
        afterCreateOrganization: async ({ organization: created, user }) => {
          await promoteUserToStaff(user.id);
          await ensureSchedulingDefaults(created.id);
          if (process.env.SEED_DEMO_DATA === "true") {
            await seedWorkspace(created.id);
          }
        },
        afterCreateInvitation: async ({ invitation, inviter, organization: invitationOrganization }) => {
          await recordOrganizationActivity({ organizationId: invitationOrganization.id, actorId: inviter.id, action: "team.invitation.created", resource: "invitation", resourceId: invitation.id, title: "Team invitation created", message: `${inviter.name} invited ${invitation.email} as ${invitation.role}.` });
        },
        afterAcceptInvitation: async ({ invitation, user, organization: invitationOrganization }) => {
          await promoteUserToStaff(user.id);
          await recordOrganizationActivity({ organizationId: invitationOrganization.id, actorId: user.id, action: "team.invitation.accepted", resource: "member", resourceId: user.id, title: "New workspace member", message: `${user.name} accepted the invitation and joined as ${invitation.role}.` });
        },
        afterUpdateMemberRole: async ({ member, previousRole, user, organization: memberOrganization }) => {
          await recordOrganizationActivity({ organizationId: memberOrganization.id, actorId: user.id, action: "team.member.role_updated", resource: "member", resourceId: member.id, title: "Member role updated", message: `${user.name} changed a member role from ${previousRole} to ${member.role}.` });
        },
        afterRemoveMember: async ({ member, user, organization: memberOrganization }) => {
          await recordOrganizationActivity({ organizationId: memberOrganization.id, actorId: user.id, action: "team.member.removed", resource: "member", resourceId: member.id, title: "Workspace member removed", message: `${user.name} removed a member from the workspace.` });
        },
        afterCreateTeam: async ({ team, user, organization: teamOrganization }) => {
          await recordOrganizationActivity({ organizationId: teamOrganization.id, actorId: user?.id, action: "team.created", resource: "team", resourceId: team.id, title: "Delivery team created", message: `${user?.name || "A workspace owner"} created ${team.name}.` });
        },
        afterDeleteTeam: async ({ team, user, organization: teamOrganization }) => {
          await recordOrganizationActivity({ organizationId: teamOrganization.id, actorId: user?.id, action: "team.deleted", resource: "team", resourceId: team.id, title: "Delivery team removed", message: `${user?.name || "A workspace owner"} removed ${team.name}.` });
        },
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
