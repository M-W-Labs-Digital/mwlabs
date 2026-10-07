const productionOrigin = "https://mwlabs.digital";

type AuthEnvironment = {
  NODE_ENV?: string;
  BETTER_AUTH_URL?: string;
  NEXT_PUBLIC_SITE_URL?: string;
};

function applicationOrigin(value: string | undefined, production: boolean) {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return undefined;
    // Production must not inherit a local development URL from a bundled .env.
    if (production && (url.protocol !== "https:" || /^(localhost|.*\.localhost|127\..*|\[::1\])$/.test(url.hostname))) return undefined;
    if (production && url.hostname === "www.mwlabs.digital") return productionOrigin;
    // Better Auth appends /api/auth; a path here would override that route.
    return url.origin;
  } catch {
    return undefined;
  }
}

export function getAuthConfig(environment: AuthEnvironment = process.env) {
  const production = environment.NODE_ENV === "production";
  const baseURL = applicationOrigin(environment.BETTER_AUTH_URL, production)
    ?? applicationOrigin(environment.NEXT_PUBLIC_SITE_URL, production)
    ?? (production ? productionOrigin : "http://localhost:3000");

  return {
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [baseURL],
  };
}
