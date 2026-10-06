import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUp, ArrowUpRight, Check, Clock3, Mail, MapPin, MessageCircle, Phone, ShieldCheck, Sparkles } from "lucide-react";
import type { ComponentProps } from "react";

type SocialIconProps = ComponentProps<"svg">;

function FacebookIcon(props: SocialIconProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M13.7 21v-8h2.8l.4-3.2h-3.2V7.75c0-.93.26-1.56 1.6-1.56H17V3.32c-.3-.04-1.3-.13-2.48-.13-2.46 0-4.15 1.5-4.15 4.27V9.8H7.6V13h2.77v8h3.33Z" /></svg>;
}

function InstagramIcon(props: SocialIconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" {...props}><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.7" r="1" fill="currentColor" stroke="none" /></svg>;
}

function LinkedInIcon(props: SocialIconProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M6.4 8.2H3.1V21h3.3V8.2ZM4.75 3A1.9 1.9 0 1 0 4.74 6.8 1.9 1.9 0 0 0 4.75 3ZM21 13.65c0-3.85-2.05-5.64-4.79-5.64-2.2 0-3.19 1.21-3.74 2.06V8.2H9.18V21h3.29v-6.34c0-1.67.32-3.3 2.4-3.3 2.05 0 2.08 1.92 2.08 3.41V21H21v-7.35Z" /></svg>;
}

function YouTubeIcon(props: SocialIconProps) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}><path d="M23 12c0-1.66-.16-2.8-.44-3.7-.28-.89-.78-1.6-1.47-2.05C19.6 5.4 15.8 5 12 5s-7.6.4-8.09 1.25C2.22 7.7 1.72 8.41 1.44 9.3 1.16 10.2 1 11.34 1 12s.16 1.8.44 2.7c.28.89.78 1.6 1.47 2.05C4.4 18.6 8.2 19 12 19s7.6-.4 8.09-1.25c.69-.45 1.19-1.16 1.47-2.05.28-.9.44-2.04.44-3.7Zm-13 3.5v-7l6 3.5-6 3.5Z" /></svg>;
}

const footerGroups = [
  {
    title: "Capabilities",
    links: [
      { label: "Web & Software", href: "/#services" },
      { label: "Digital Marketing", href: "/#services" },
      { label: "Brand Systems", href: "/#services" },
      { label: "AI & Automation", href: "/#services" },
    ],
  },
  {
    title: "Discover",
    links: [
      { label: "About the Studio", href: "/#about" },
      { label: "Selected Work", href: "/work" },
      { label: "Our Process", href: "/#process" },
      { label: "Studio Insights", href: "/blog" },
    ],
  },
  {
    title: "Workspace",
    links: [
      { label: "Agency Login", href: "/sign-in" },
      { label: "Register a Project", href: "/register" },
      { label: "Client Stories", href: "/#testimonials" },
      { label: "Contact", href: "/#contact-details" },
    ],
  },
];

const nextSteps = [
  { number: "01", title: "We study the brief", copy: "Goals, audience, constraints, and the commercial outcome." },
  { number: "02", title: "We align on strategy", copy: "A focused conversation to challenge assumptions and define direction." },
  { number: "03", title: "You receive a roadmap", copy: "Clear scope, priorities, timing, investment, and the first milestone." },
];

const socialLinks = [
  { platform: "Instagram", detail: "Visual work & studio life", href: "https://www.instagram.com/info.mwlabs", icon: InstagramIcon, color: "group-hover:bg-[#e1306c]" },
  { platform: "LinkedIn", detail: "Thinking & company updates", href: "https://www.linkedin.com/company/mwlabs", icon: LinkedInIcon, color: "group-hover:bg-[#0a66c2]" },
  { platform: "Facebook", detail: "Community & announcements", href: "https://www.facebook.com/info.mwlabs/", icon: FacebookIcon, color: "group-hover:bg-[#1877f2]" },
  { platform: "YouTube", detail: "Stories, demos & explainers", href: "https://youtube.com/@mw_labs", icon: YouTubeIcon, color: "group-hover:bg-[#ff0000]" },
];

export function MarketingFooter() {
  return (
    <footer id="contact" className="relative overflow-hidden bg-brand-ink text-white">
      <div className="marketing-grid-dark pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />
      <div className="pointer-events-none absolute -right-40 -top-52 size-[40rem] rounded-full bg-blue-600/20 blur-[130px]" />
      <div className="pointer-events-none absolute -bottom-64 left-[15%] size-[38rem] rounded-full bg-cyan-400/10 blur-[140px]" />
      <div className="pointer-events-none absolute right-[-0.04em] top-[29%] hidden select-none text-[23vw] font-black leading-none tracking-[-0.1em] text-white/[0.018] xl:block">MW</div>

      <div className="relative mx-auto max-w-[104rem] px-4 py-10 sm:px-6 sm:py-16 lg:px-12 lg:py-20 2xl:px-16">
        <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] shadow-[0_40px_120px_rgba(0,0,0,0.25)] backdrop-blur-xl sm:rounded-[2.5rem]">
          <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1fr_19rem] lg:items-end lg:p-12 xl:grid-cols-[1fr_22rem]">
            <div className="min-w-0">
              <div className="inline-flex max-w-full items-center gap-2 text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-cyan-300 sm:text-xs sm:tracking-[0.24em]"><Sparkles className="size-4 shrink-0" /> Your next move starts here</div>
              <h2 className="footer-title mt-5 max-w-5xl font-black">Tell us what needs to <span className="text-gradient-light">move forward.</span></h2>
              <p className="mt-5 max-w-2xl text-sm font-semibold leading-7 text-slate-400 sm:text-base sm:leading-8">A product to launch, a brand to reposition, a pipeline to improve, or repetitive work to automate—we will help identify the highest-leverage next step.</p>
              <div className="mt-7 grid gap-3 min-[430px]:grid-cols-2 sm:flex sm:flex-wrap">
                <Link href="/register" className="group inline-flex min-h-13 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-brand-ink transition hover:-translate-y-1 hover:bg-cyan-300 sm:px-7">Register your project <ArrowRight className="ml-3 size-4 transition group-hover:translate-x-1" /></Link>
                <Link href="https://wa.me/442037697100" target="_blank" rel="noreferrer" className="inline-flex min-h-13 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] px-5 text-sm font-black text-white transition hover:-translate-y-1 hover:border-emerald-300/40 hover:bg-emerald-400/10 sm:px-7"><MessageCircle className="mr-3 size-4 text-emerald-300" />Chat on WhatsApp</Link>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-[#061334]/80 p-5 sm:p-6">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-500/15 text-cyan-300"><Clock3 className="size-4" /></span><div><p className="text-[0.58rem] font-extrabold uppercase tracking-[0.16em] text-slate-500">Typical response</p><p className="mt-1 text-sm font-black">Within one business day</p></div></div>
              <div className="my-5 h-px bg-white/10" />
              <ul className="space-y-3 text-xs font-bold leading-5 text-slate-400">
                <li className="flex gap-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />No generic sales deck</li>
                <li className="flex gap-2.5"><Check className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />A practical first recommendation</li>
                <li className="flex gap-2.5"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-300" />Your project context stays private</li>
              </ul>
            </aside>
          </div>

          <div className="grid border-t border-white/10 sm:grid-cols-3">
            {nextSteps.map((step, index) => <div key={step.number} className="relative border-b border-white/10 p-5 last:border-b-0 sm:border-b-0 sm:border-r sm:p-6 sm:last:border-r-0 lg:p-7"><span className="text-[0.62rem] font-black text-cyan-300">{step.number}</span><h3 className="mt-3 text-sm font-black sm:text-base">{step.title}</h3><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{step.copy}</p>{index < nextSteps.length - 1 && <ArrowRight className="absolute right-5 top-6 hidden size-4 text-white/15 sm:block" />}</div>)}
          </div>
        </div>

        <div className="grid gap-12 py-14 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 xl:gap-24">
          <div className="min-w-0">
            <Link href="/#top" className="relative block h-12 w-44 rounded-xl bg-white px-2 sm:h-14 sm:w-52" aria-label="M&W Labs home">
              <Image src="/mw-logo.png" alt="M&W Labs" fill sizes="208px" className="object-contain p-1.5" />
            </Link>
            <p className="mt-6 max-w-xl text-2xl font-black leading-tight tracking-[-0.035em] text-slate-200 sm:text-3xl">We build the digital layer between your ambition and your next stage of growth.</p>
            <p className="mt-5 max-w-lg text-sm font-semibold leading-7 text-slate-500">Independent studio in Dhaka, working with founders and teams worldwide across strategy, product, marketing, content, and intelligent operations.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-emerald-300"><span className="size-2 animate-pulse rounded-full bg-emerald-400" /> Selected projects open</span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.6rem] font-extrabold uppercase tracking-[0.14em] text-slate-400">Dhaka · UTC+6</span>
            </div>
          </div>

          <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 sm:gap-8">
            {footerGroups.map((group, index) => (
              <div key={group.title} className={index === 2 ? "col-span-2 sm:col-span-1" : ""}>
                <h3 className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-slate-600">{group.title}</h3>
                <ul className="mt-5 space-y-3.5 text-sm font-semibold text-slate-300">
                  {group.links.map((link) => <li key={link.label}><Link href={link.href} className="transition hover:text-cyan-300">{link.label}</Link></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="grid gap-5 border-y border-white/10 py-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section id="contact-details" className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <p className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-cyan-300">Direct contact</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Link href="mailto:hello@mwlabs.digital" className="group flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-cyan-300"><Mail className="size-4" /></span><span className="min-w-0"><span className="block text-[0.56rem] font-bold uppercase tracking-wider text-slate-600">Email</span><span className="block truncate text-xs font-black text-slate-300 transition group-hover:text-white sm:text-sm">hello@mwlabs.digital</span></span></Link>
              <Link href="tel:+442037697100" className="group flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-cyan-300"><Phone className="size-4" /></span><span><span className="block text-[0.56rem] font-bold uppercase tracking-wider text-slate-600">Phone</span><span className="block text-xs font-black text-slate-300 transition group-hover:text-white sm:text-sm">+442037697100</span></span></Link>
              <div className="flex items-center gap-3 sm:col-span-2"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-cyan-300"><MapPin className="size-4" /></span><span><span className="block text-[0.56rem] font-bold uppercase tracking-wider text-slate-600">Studio base</span><span className="block text-xs font-black text-slate-300 sm:text-sm">Demra, Dhaka · Collaborating worldwide</span></span></div>
            </div>
          </section>

          <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <Link key={social.platform} href={social.href} target="_blank" rel="noreferrer" className="group flex min-h-32 flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:-translate-y-1 hover:border-cyan-300/25 hover:bg-white/[0.06]">
                  <div className="flex items-start justify-between">
                    <span className={`grid size-10 place-items-center rounded-xl bg-white/[0.06] text-slate-300 transition duration-300 group-hover:text-white ${social.color}`}><Icon className="size-4" /></span>
                    <ArrowUpRight className="size-4 text-slate-600 transition group-hover:text-cyan-300" />
                  </div>
                  <div><p className="text-xs font-black text-slate-200 sm:text-sm">{social.platform}</p><p className="mt-1 text-[0.58rem] font-semibold leading-4 text-slate-600">{social.detail}</p></div>
                </Link>
              );
            })}
          </section>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 M&amp;W Labs · Built locally · All rights reserved</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2"><Link href="/sign-in" className="transition hover:text-slate-300">Private workspace</Link><Link href="/#top" className="inline-flex items-center text-slate-400 transition hover:text-cyan-300">Return to top <ArrowUp className="ml-2 size-3.5" /></Link></div>
        </div>
      </div>
    </footer>
  );
}
