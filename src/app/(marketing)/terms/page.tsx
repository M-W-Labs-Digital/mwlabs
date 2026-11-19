import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the M&W Labs website and engaging with our public information.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="mx-auto min-h-[60svh] max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600">M&amp;W Labs</p>
      <h1 className="mt-4 text-4xl font-black text-slate-950 sm:text-5xl">Terms of Service</h1>
      <p className="mt-5 text-sm font-semibold text-slate-500">Effective November 14, 2026</p>
      <div className="mt-10 space-y-8 text-sm font-medium leading-7 text-slate-700">
        <section><h2 className="text-xl font-black text-slate-950">Website use</h2><p className="mt-2">You may use this website to learn about M&amp;W Labs and contact us. Do not misuse the website, interfere with its operation, or use its content in a way that violates applicable law or another party&apos;s rights.</p></section>
        <section><h2 className="text-xl font-black text-slate-950">Services and project agreements</h2><p className="mt-2">Website descriptions are general information, not an offer or guarantee of a particular result. The scope, fees, schedule, deliverables, and ownership for any commissioned work will be set out in a separate written agreement accepted by both parties. That agreement controls if it conflicts with these website terms.</p></section>
        <section><h2 className="text-xl font-black text-slate-950">Website content</h2><p className="mt-2">Unless stated otherwise, M&amp;W Labs owns or is authorized to use the website’s text, branding, and other materials. You may not reproduce or commercially exploit them without prior permission, except where applicable law allows.</p></section>
        <section><h2 className="text-xl font-black text-slate-950">Availability and changes</h2><p className="mt-2">We may update or remove website content and may temporarily suspend access for maintenance or operational reasons. The website is provided for general information without a promise of uninterrupted availability.</p></section>
        <section><h2 className="text-xl font-black text-slate-950">Contact</h2><p className="mt-2">Questions about these terms can be sent to <Link className="font-bold text-blue-700" href="mailto:hello@mwlabs.digital">hello@mwlabs.digital</Link>.</p></section>
      </div>
    </article>
  );
}