import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LeadRegistrationForm } from "@/components/auth/lead-registration-form";
import { getRegistrationPageState } from "@/lib/registration-page";

export const metadata: Metadata = {
  title: "Register your project",
  description: "Create a secure M&W Labs project profile and enter the lead workflow.",
};
export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const query = await searchParams;
  const state = await getRegistrationPageState(query.new === "1");
  if (state.status === "redirect") redirect(state.destination);
  if (state.status === "unavailable") {
    return (
      <section className="mx-auto max-w-xl px-5 py-24" role="alert">
        <h1 className="text-3xl font-semibold tracking-tight">Project registration is temporarily unavailable.</h1>
        <p className="mt-4 leading-7 text-muted-foreground">We couldn&apos;t connect to the registration service. Please try again shortly, or contact M&amp;W Labs about your project.</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={query.new === "1" ? "/register?new=1" : "/register"} prefetch={false} className="rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white">Try again</Link>
          <Link href="/#contact" className="rounded-xl border px-5 py-3 font-semibold">Contact M&amp;W Labs</Link>
        </div>
      </section>
    );
  }
  return <LeadRegistrationForm {...state} />;
}
