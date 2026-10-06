export type WorkspaceRole = "owner" | "admin" | "member" | string;

const memberModules = new Set([
  "overview",
  "ai",
  "inbox",
  "clients",
  "onboarding",
  "projects",
  "tasks",
  "calendar",
  "scheduling",
  "time",
  "documents",
]);

export function canAccessModule(role: WorkspaceRole, module: string) {
  if (role === "customer") return module === "overview";
  if (role === "owner" || role === "admin") return true;
  return role === "member" && memberModules.has(module);
}

const memberReadableResources = new Set([
  "clients", "projects", "milestones", "tasks", "calendar-events",
  "time-entries", "documents", "activities", "knowledge",
]);
const memberWritableResources = new Set([
  "tasks", "calendar-events", "time-entries", "documents", "activities", "knowledge",
]);

export function isWorkspaceAdmin(role: WorkspaceRole) {
  return role === "owner" || role === "admin";
}

export function canReadResource(role: WorkspaceRole, resource: string) {
  return isWorkspaceAdmin(role) || (role === "member" && memberReadableResources.has(resource));
}

export function canWriteResource(role: WorkspaceRole, resource: string) {
  return isWorkspaceAdmin(role) || (role === "member" && memberWritableResources.has(resource));
}

export function notificationAccessWhere(role: WorkspaceRole) {
  if (isWorkspaceAdmin(role)) return {};
  if (role !== "member") return { id: { in: [] as string[] } };
  return { OR: [
    { actionUrl: null },
    { actionUrl: "/app" },
    ...Array.from(memberModules, (name) => ({ actionUrl: `/app/${name}` })),
  ] };
}
