"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Target,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";

const serviceOptions = [
  "Web & software development",
  "Digital marketing",
  "Branding & design",
  "Video & content",
  "AI & automation",
  "Growth strategy",
  "Multiple services",
];

const budgetOptions = [
  "Under £2,500",
  "£2,500–£5,000",
  "£5,000–£10,000",
  "£10,000–£25,000",
  "£25,000+",
  "Not sure yet",
];

type RegistrationDefaults = {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  serviceInterest?: string;
  budgetRange?: string;
  projectBrief?: string;
};

type LeadRegistrationFormProps = {
  profileOnly?: boolean;
  defaults?: RegistrationDefaults;
  workspaceReady: boolean;
  newRequest?: boolean;
};

export function LeadRegistrationForm({
  profileOnly = false,
  defaults = {},
  workspaceReady,
  newRequest = false,
}: LeadRegistrationFormProps) {
  const [accountCreated, setAccountCreated] = useState(false);
  const completingProfile = profileOnly || accountCreated;
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [formStartedAt] = useState(() => String(Date.now()));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceReady) {
      toast.error("Registration is temporarily unavailable");
      return;
    }

    const form = new FormData(event.currentTarget);
    const profile = {
      name: String(form.get("name") ?? "").trim(),
      company: String(form.get("company") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      serviceInterest: String(form.get("serviceInterest") ?? "").trim(),
      budgetRange: String(form.get("budgetRange") ?? "").trim(),
      projectBrief: String(form.get("projectBrief") ?? "").trim(),
    };
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (
      !profile.name ||
      !profile.company ||
      (!completingProfile && !email) ||
      !profile.serviceInterest ||
      !profile.budgetRange ||
      profile.projectBrief.length < 10
    ) {
      toast.error("Complete your registration", {
        description: "Please fill in every required project field.",
      });
      return;
    }

    if (!completingProfile) {
      const strongPassword =
        password.length >= 10 &&
        /[a-z]/.test(password) &&
        /[A-Z]/.test(password) &&
        /\d/.test(password);
      if (!strongPassword) {
        toast.error("Create a stronger password", {
          description: "Use 10+ characters with uppercase, lowercase and a number.",
        });
        return;
      }
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
    }

    setPending(true);
    try {
      if (!completingProfile) {
        const result = await authClient.signUp.email({
          ...profile,
          email,
          password,
          name: profile.name,
          callbackURL: "/auth/verified",
        });
        if (result.error) throw new Error(result.error.message);
        setAccountCreated(true);
      }

      const response = await fetch("/api/registrations/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...profile, website: String(form.get("website") ?? ""), formStartedAt, newRequest }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Could not complete registration.");
      }

      toast.success(completingProfile ? "Your project profile is complete" : "Registration complete", {
        description: "Your project is in the workflow; you can book discovery from the portal.",
      });
      router.push("/app");
      router.refresh();
    } catch (error) {
      toast.error("Could not complete registration", {
        description:
          error instanceof Error
            ? error.message
            : "Please try again or sign in if you already have an account.",
      });
    } finally {
      setPending(false);
    }
  }

  const passwordChecks = [
    { label: "10+ characters", met: password.length >= 10 },
    { label: "Upper & lowercase", met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: "At least one number", met: /\d/.test(password) },
  ];

  return (
    <div className="relative isolate overflow-hidden bg-[#f7faff] pb-20 pt-14 sm:pt-20 lg:pb-28 lg:pt-24">
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_14%_18%,rgba(37,99,235,0.12),transparent_26rem),radial-gradient(circle_at_88%_28%,rgba(34,211,238,0.14),transparent_30rem)]" />
      <div className="marketing-grid pointer-events-none absolute inset-0 -z-10 opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent_88%)]" />

      <div className="mx-auto grid max-w-[94rem] gap-10 px-4 sm:px-6 lg:grid-cols-[0.76fr_1.24fr] lg:items-start lg:gap-14 lg:px-12">
        <section className="lg:sticky lg:top-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/82 px-3 py-2 text-[0.62rem] font-black uppercase tracking-[0.18em] text-blue-700 shadow-sm backdrop-blur-xl">
            <span className="size-2 rounded-full bg-cyan-400 shadow-[0_0_0_5px_rgba(34,211,238,0.12)]" />
            Secure project registration
          </div>
          <h1 className="mt-7 max-w-2xl text-5xl font-black leading-[0.92] tracking-[-0.06em] text-slate-950 sm:text-6xl lg:text-7xl">
            Turn your idea into a <span className="text-gradient">clear next step.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base font-semibold leading-8 text-slate-600 sm:text-lg">
            Register once, share the essentials, book discovery, and follow your opportunity from initial review to proposal.
          </p>

          <div className="mt-9 space-y-3">
            {[
              { icon: UserRoundCheck, title: "Create your secure profile", copy: "Your details stay connected to one CRM record." },
              { icon: Target, title: "We qualify the opportunity", copy: "The right specialist reviews scope, fit and urgency." },
              { icon: Workflow, title: "Book and track discovery", copy: "Meetings, proposals, and next actions stay visible in one workflow." },
            ].map(({ icon: Icon, title, copy }, index) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-white/90 bg-white/60 p-4 shadow-[0_16px_45px_rgba(37,99,235,0.06)] backdrop-blur-xl">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-950 text-white">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-[0.58rem] font-black uppercase tracking-[0.16em] text-blue-600">Step 0{index + 1}</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{title}</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{copy}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-500">
            <ShieldCheck className="size-4 text-blue-600" /> No payment or commitment is required.
          </p>
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-white/95 bg-white/90 shadow-[0_36px_110px_rgba(22,55,120,0.14)] ring-1 ring-blue-100/70 backdrop-blur-2xl sm:rounded-[2.5rem]">
          <div className="border-b border-blue-50 bg-[linear-gradient(135deg,#f8fbff,#ffffff_55%,#ecfeff)] px-5 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[0.62rem] font-black uppercase tracking-[0.2em] text-blue-600">
                  {completingProfile ? "Complete your lead profile" : "Register your opportunity"}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-3xl">
                  Tell us what growth looks like for you.
                </h2>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-2 text-[0.58rem] font-black uppercase tracking-[0.14em] text-emerald-700">
                <LockKeyhole className="size-3.5" /> Private intake
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 p-5 sm:p-8">
            <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="registration-name">Your name</Label>
                <Input id="registration-name" name="name" autoComplete="name" defaultValue={defaults.name} placeholder="Your full name" required className="h-12 rounded-xl bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration-company">Company</Label>
                <Input id="registration-company" name="company" autoComplete="organization" defaultValue={defaults.company} placeholder="Company or brand" required className="h-12 rounded-xl bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration-email">Work email</Label>
                <Input id="registration-email" name="email" type="email" autoComplete="email" defaultValue={defaults.email} placeholder="you@company.com" disabled={completingProfile} required className="h-12 rounded-xl bg-white disabled:opacity-70" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration-phone">Phone <span className="font-normal text-slate-400">(optional)</span></Label>
                <Input id="registration-phone" name="phone" type="tel" autoComplete="tel" defaultValue={defaults.phone} placeholder="+44 20 3769 7100" className="h-12 rounded-xl bg-white" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration-service">Primary service</Label>
                <div className="relative">
                  <select id="registration-service" name="serviceInterest" defaultValue={defaults.serviceInterest ?? ""} required className="h-12 w-full appearance-none rounded-xl border border-input bg-white px-3 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20">
                    <option value="" disabled>Select a service</option>
                    {serviceOptions.map((service) => <option key={service}>{service}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="registration-budget">Indicative budget</Label>
                <div className="relative">
                  <select id="registration-budget" name="budgetRange" defaultValue={defaults.budgetRange ?? ""} required className="h-12 w-full appearance-none rounded-xl border border-input bg-white px-3 pr-10 text-sm font-semibold text-slate-800 outline-none transition focus:border-ring focus:ring-3 focus:ring-ring/20">
                    <option value="" disabled>Select a range</option>
                    {budgetOptions.map((budget) => <option key={budget}>{budget}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="registration-brief">Project brief</Label>
                <span className="text-[0.62rem] font-bold text-slate-400">Goals · challenges · timing</span>
              </div>
              <Textarea id="registration-brief" name="projectBrief" defaultValue={defaults.projectBrief} minLength={10} maxLength={4000} placeholder="What are you trying to achieve, and what is currently getting in the way?" required className="min-h-32 resize-y rounded-xl bg-white py-3" />
            </div>

            {!completingProfile && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50/45 p-4 sm:p-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="registration-password">Create password</Label>
                    <div className="relative">
                      <Input id="registration-password" name="password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} required className="h-12 rounded-xl bg-white pr-11" />
                      <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-blue-600" aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="registration-confirm-password">Confirm password</Label>
                    <Input id="registration-confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={10} maxLength={128} required className="h-12 rounded-xl bg-white" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  {passwordChecks.map((check) => (
                    <span key={check.label} className={`inline-flex items-center gap-1.5 text-[0.65rem] font-bold ${check.met ? "text-emerald-700" : "text-slate-400"}`}>
                      <span className={`grid size-4 place-items-center rounded-full ${check.met ? "bg-emerald-100" : "bg-slate-200/70"}`}><Check className="size-2.5" /></span>
                      {check.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {!workspaceReady && (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Registration will open after the M&amp;W workspace is initialized.
              </p>
            )}

            <label className="flex items-start gap-3 text-xs font-semibold leading-5 text-slate-500">
              <input type="checkbox" required className="mt-0.5 size-4 rounded border-slate-300 accent-blue-600" />
              <span>I agree that M&amp;W Labs may use these details to assess my project and contact me about relevant next steps.</span>
            </label>

            <Button type="submit" disabled={pending || !workspaceReady} className="group h-14 w-full rounded-xl bg-slate-950 text-sm font-black text-white shadow-[0_18px_45px_rgba(15,23,42,0.2)] hover:bg-blue-700">
              {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {pending ? "Registering your project…" : completingProfile ? "Complete project profile" : "Register and submit project"}
              {!pending && <ArrowRight className="size-4 transition group-hover:translate-x-1" />}
            </Button>

            {!completingProfile && (
              <p className="text-center text-sm font-semibold text-slate-500">
                Already registered?{" "}
                <Link href="/sign-in?next=/app" className="font-black text-blue-700 underline decoration-blue-200 underline-offset-4">Sign in to your workspace</Link>
              </p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
