import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { defaultPostAuthPath, safePostAuthPath } from "@/lib/auth-shared";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const requested = typeof params.next === "string" ? params.next : undefined;
  const nextPath = safePostAuthPath(requested);

  // Never render or preserve credentials supplied through a URL.
  if (typeof params.email === "string" || typeof params.username === "string" || typeof params.password === "string") {
    redirect(nextPath === defaultPostAuthPath ? "/sign-in" : `/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  return (
    <AuthForm
      mode="sign-in"
      googleEnabled={Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)}
      nextPath={nextPath}
      oauthError={typeof params.error === "string"}
    />
  );
}
