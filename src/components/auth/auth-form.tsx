"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { Auth3DScene } from "@/components/auth/auth-3d-scene";

type AuthFormProps = {
  mode: "sign-in" | "sign-up";
  googleEnabled: boolean;
  nextPath?: string;
  oauthError?: boolean;
};

function makeSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `${normalized || "agency"}-${crypto.randomUUID().slice(0, 5)}`;
}

export function AuthForm({ mode, googleEnabled, nextPath = "/auth/continue", oauthError = false }: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signUpMode = mode === "sign-up";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const agency = String(form.get("agency") ?? "").trim();

    if (!email || !password || (signUpMode && (password.length < 10 || !name || !agency))) {
      toast.error("Check the form", {
        description: signUpMode ? "Use a valid email and a password of at least 10 characters." : "Enter your email and password.",
      });
      return;
    }

    setPending(true);
    try {
      if (signUpMode) {
        const result = await authClient.signUp.email({ email, password, name, callbackURL: "/auth/verified" });
        if (result.error) throw new Error(result.error.message);

        const workspace = await authClient.organization.create({
          name: agency,
          slug: makeSlug(agency),
        });
        if (workspace.error || !workspace.data) {
          throw new Error(workspace.error?.message ?? "Could not create the workspace.");
        }
        await authClient.organization.setActive({ organizationId: workspace.data.id });
        const upgrade = await fetch("/api/registrations/owner", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ organizationId: workspace.data.id }),
        });
        if (!upgrade.ok) {
          const payload = (await upgrade.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Could not activate owner access.");
        }
        toast.success("Your agency workspace is ready");
        router.push("/app");
      } else {
        const result = await authClient.signIn.email({
          email,
          password,
          rememberMe: true,
          callbackURL: nextPath,
        });
        if (result.error) throw new Error(result.error.message);
        // Load a fresh server tree after the session cookie has been written.
        window.location.assign(nextPath);
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(signUpMode ? "Could not create your workspace" : "Could not sign in", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setPending(true);
    try {
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: nextPath,
        newUserCallbackURL: nextPath,
        errorCallbackURL: "/sign-in?error=oauth",
      });
      if (result?.error) throw new Error(result.error.message);
    } catch (error) {
      setPending(false);
      toast.error("Google sign-in failed", { description: error instanceof Error ? error.message : "Please try again." });
    }
  }

  return (
    <div className="auth-page relative isolate grid min-h-[calc(100svh-4.5rem)] overflow-hidden bg-[#f5f8fc] pt-18 lg:grid-cols-[0.92fr_1.08fr]">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_10%,rgba(37,99,235,0.12),transparent_28rem),radial-gradient(circle_at_78%_80%,rgba(6,182,212,0.1),transparent_24rem)]" />
      <section className="flex items-center justify-center px-5 py-12 sm:px-10 sm:py-16">
        <div className="w-full max-w-[30rem] rounded-[1.75rem] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.09)] backdrop-blur-xl sm:p-9">
          <div className="mb-8">
            <div className="mb-6 flex items-center gap-2 text-[0.62rem] font-black uppercase tracking-[0.18em] text-blue-700"><span className="grid size-8 place-items-center rounded-lg bg-blue-600 text-white"><LockKeyhole className="size-3.5" /></span> Private workspace</div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {signUpMode ? "Start your command center" : "Welcome back"}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tighter text-slate-950 sm:text-5xl">
              {signUpMode ? "Set up M&W Command." : "Continue to M&W Command."}
            </h1>
            <p className="mt-4 max-w-md leading-7 text-muted-foreground">
              {signUpMode
                ? "Create the first owner account for M&W Labs. Disable initial signup immediately afterward."
                : "Return to the private operating system for M&W Labs."}
            </p>
          </div>

          {oauthError && <p role="alert" className="mb-6 text-sm text-destructive">Google sign-in could not be completed. Please try again or sign in with email.</p>}

          {googleEnabled && (
            <Button type="button" variant="outline" className="h-11 w-full" onClick={handleGoogle} disabled={pending}>
              <span className="grid size-5 place-items-center rounded-full bg-white text-xs font-bold text-[#4285f4] shadow-sm">G</span>
              Continue with Google
            </Button>
          )}

          {googleEnabled && (
            <div className="my-6 flex items-center gap-4 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or use email <span className="h-px flex-1 bg-border" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {signUpMode && (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" name="name" autoComplete="name" placeholder="Avery Kim" required className="h-11 bg-white" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agency">Agency name</Label>
                  <Input id="agency" name="agency" autoComplete="organization" defaultValue="M&W Labs" required className="h-11 bg-white" />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@mwlabs.digital" required className="h-11 bg-white" />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={signUpMode ? "new-password" : "current-password"}
                  minLength={signUpMode ? 10 : undefined}
                  maxLength={signUpMode ? 128 : undefined}
                  required
                  className="h-11 bg-white pr-11"
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            {!signUpMode && <div className="-mt-2 text-right"><Link href="/forgot-password" className="text-xs font-semibold text-muted-foreground underline underline-offset-4 hover:text-foreground">Forgot password?</Link></div>}
            <Button type="submit" className="h-12 w-full rounded-xl bg-slate-950 text-white shadow-[0_12px_26px_rgba(15,23,42,0.16)] hover:bg-blue-700" disabled={pending}>
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : signUpMode ? "Create my workspace" : "Sign in"}
              {!pending && <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {signUpMode ? "Already have access?" : "Planning a project?"}{" "}
            <Link href={signUpMode ? "/sign-in" : "/register"} className="font-semibold text-foreground underline underline-offset-4">
              {signUpMode ? "Sign in" : "Register with M&W"}
            </Link>
          </p>
          <p className="mt-7 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 text-emerald-600" /> Encrypted, role-scoped, database-backed sessions
          </p>
        </div>
      </section>

      <aside className="noise relative hidden min-h-[42rem] overflow-hidden bg-brand-ink text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_52%_48%,rgba(14,116,144,0.28),transparent_30%),linear-gradient(145deg,#020617,#061b3d_55%,#02111f)]" />
        <div className="relative z-10 flex items-center justify-between p-12 pb-0"><div><p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-cyan-300">M&amp;W Command / live system</p><p className="mt-2 text-sm font-semibold text-white/55">A clear view of the work ahead.</p></div><Sparkles className="size-6 text-accent" /></div>
        <div className="absolute inset-0"><Auth3DScene /></div>
        <div className="relative z-10 max-w-2xl p-12 pt-0">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Today in your agency</p>
          <blockquote className="mt-6 max-w-2xl text-balance text-4xl font-medium leading-[1.08] tracking-tighter">
            “I found the client risk, revised the resource plan, and drafted tomorrow&apos;s priorities.”
          </blockquote>
          <div className="mt-9 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-accent text-accent-foreground"><Sparkles className="size-4" /></span>
            <div><p className="text-sm font-semibold">M&amp;W Intelligence</p><p className="text-xs text-white/42">The agency&apos;s second brain</p></div>
          </div>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-3 p-12 pt-0">
          {[['$114k', 'weighted pipeline'], ['57.8%', 'gross margin'], ['91%', 'on-time work']].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-xl font-semibold">{value}</p><p className="mt-1 text-[11px] text-white/40">{label}</p></div>
          ))}
        </div>
      </aside>
    </div>
  );
}
