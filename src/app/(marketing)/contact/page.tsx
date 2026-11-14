import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact M&W Labs about digital products, marketing, design, content, and automation.",
  alternates: { canonical: "/contact" },
};

const contacts = [
  { label: "Email", value: "hello@mwlabs.digital", href: "mailto:hello@mwlabs.digital", Icon: Mail },
  { label: "Phone", value: "+44 20 3769 7100", href: "tel:+442037697100", Icon: Phone },
];

export default function ContactPage() {
  return (
    <article className="mx-auto min-h-[60svh] max-w-4xl px-5 py-20 sm:px-8 sm:py-28">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-blue-600">Get in touch</p>
      <h1 className="mt-4 text-4xl font-black text-slate-950 sm:text-5xl">Contact M&amp;W Labs</h1>
      <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-slate-600">Tell us what you want to build, market, design, or automate. Our team typically responds within one business day.</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {contacts.map(({ label, value, href, Icon }) => (
          <a key={label} href={href} className="flex items-center gap-4 border-t border-slate-200 py-5 text-slate-900 hover:text-blue-700">
            <Icon className="size-5 text-blue-600" />
            <span><span className="block text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span><span className="mt-1 block font-extrabold">{value}</span></span>
          </a>
        ))}
      </div>
      <p className="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-600"><MapPin className="size-5 text-blue-600" />Demra, Dhaka, Bangladesh - Collaborating worldwide</p>
      <Link href="/book" className="mt-9 inline-flex font-extrabold text-blue-700 hover:text-blue-900">Book a discovery call</Link>
    </article>
  );
}