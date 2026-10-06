import { createHash } from "node:crypto";

const requestBuckets = new Map<string, { count: number; resetAt: number }>();
const recentSubmissions = new Map<string, number>();
const disposableDomains = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "yopmail.com",
]);

function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local";
}

function prune(now: number) {
  for (const [key, value] of requestBuckets) if (value.resetAt <= now) requestBuckets.delete(key);
  for (const [key, timestamp] of recentSubmissions) if (timestamp <= now) recentSubmissions.delete(key);
}

export function spamFingerprint(values: { email?: string; name?: string; message?: string; ip?: string }) {
  return createHash("sha256")
    .update([values.ip ?? "", values.email ?? "", values.name ?? "", values.message ?? ""].join("\u001f").toLowerCase())
    .digest("hex");
}

export function assessPublicSubmission(request: Request, values: {
  email?: string;
  name?: string;
  message?: string;
  honeypot?: string;
  formStartedAt?: string;
}, options: { bucket: string; limit: number; duplicateWindowMs?: number }) {
  const now = Date.now();
  prune(now);
  const address = clientAddress(request);
  const bucketKey = `${options.bucket}:${address}`;
  const current = requestBuckets.get(bucketKey);
  if (!current || current.resetAt <= now) {
    if (!current && requestBuckets.size >= 10_000) return { allowed: false, status: 429, error: "Too many requests. Please try again later." };
    requestBuckets.set(bucketKey, { count: 1, resetAt: now + 60 * 60 * 1_000 });
  } else if (current.count >= options.limit) {
    return { allowed: false, status: 429, error: "Too many requests. Please try again later." };
  } else {
    current.count += 1;
  }

  if (values.honeypot?.trim()) return { allowed: false, status: 202, error: null };

  const startedAt = values.formStartedAt?.trim() ? Number(values.formStartedAt) : NaN;
  if (Number.isFinite(startedAt) && (now - startedAt < 1_200 || now - startedAt > 24 * 60 * 60 * 1_000)) {
    return { allowed: false, status: 202, error: null };
  }

  const domain = values.email?.split("@").at(-1)?.toLowerCase();
  if (domain && disposableDomains.has(domain)) return { allowed: false, status: 400, error: "Please use a professional email address." };

  const fingerprint = spamFingerprint({ ...values, ip: address });
  const duplicateWindowMs = options.duplicateWindowMs ?? 15 * 60 * 1_000;
  if (recentSubmissions.has(fingerprint)) return { allowed: false, status: 409, error: "This request was already received. Please check your confirmation before submitting again." };

  return { allowed: true, status: 200, error: null, commit: () => { if (recentSubmissions.size < 10_000) recentSubmissions.set(fingerprint, Date.now() + duplicateWindowMs); } };
}
