import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  Clapperboard,
  ClipboardList,
  Code2,
  Globe2,
  Lightbulb,
  LineChart,
  Megaphone,
  MessageSquareQuote,
  MousePointerClick,
  PenTool,
  Rocket,
  SearchCheck,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import { GrowthSystemShowcase } from "@/components/marketing/growth-system-showcase";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { MarketingReception, ProjectEnquiryForm, TestimonialsCarousel } from "@/components/marketing/marketing-interactions";
import { ContentCover } from "@/components/marketing/published-content";
import { Reveal } from "@/components/marketing/reveal";
import { getHomepageContent, siteUrl } from "@/lib/public-content";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

type Service = {
  icon: LucideIcon;
  title: string;
  copy: string;
  tone: string;
};

const services: Service[] = [
  { icon: Code2, title: "Web & Software Development", copy: "Custom websites, web apps, SaaS platforms, dashboards and business systems.", tone: "bg-blue-600 text-white" },
  { icon: Megaphone, title: "Digital Marketing", copy: "SEO, Google & Meta Ads, lead generation, funnels, email and WhatsApp marketing.", tone: "bg-cyan-50 text-cyan-700" },
  { icon: PenTool, title: "Branding & Design", copy: "Logo design, brand identity, social media creatives, brochures and more.", tone: "bg-blue-50 text-blue-700" },
  { icon: Clapperboard, title: "Video Editing & Content", copy: "Reels, YouTube videos, ads, corporate videos, motion graphics and more.", tone: "bg-slate-100 text-slate-700" },
  { icon: Bot, title: "AI & Automation", copy: "AI chatbots, agents, workflows, dashboards and smart integrations.", tone: "bg-brand-navy text-cyan-300" },
  { icon: LineChart, title: "Growth Strategy", copy: "Business strategy, market research, competitor analysis and scaling plans.", tone: "bg-indigo-50 text-indigo-700" },
];

const homepageJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}#organization`,
      name: "M&W Labs",
      url: siteUrl.toString(),
      description: "An independent digital studio in Dhaka building digital products and growth systems for teams worldwide.",
      email: "hello@mwlabs.digital",
      telephone: "+442037697100",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Dhaka",
        addressCountry: "BD",
      },
      sameAs: [
        "https://www.instagram.com/info.mwlabs",
        "https://www.linkedin.com/company/mwlabs",
        "https://www.facebook.com/info.mwlabs/",
        "https://youtube.com/@mw_labs",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}#website`,
      url: siteUrl.toString(),
      name: "M&W Labs",
      publisher: { "@id": `${siteUrl}#organization` },
      inLanguage: "en",
    },
    {
      "@type": "WebPage",
      "@id": `${siteUrl}#homepage`,
      url: siteUrl.toString(),
      name: "M&W Labs — Build. Market. Automate. Grow.",
      description: "M&W Labs builds websites, software, brands, campaigns, content, and AI automation that drive measurable growth.",
      isPartOf: { "@id": `${siteUrl}#website` },
      about: { "@id": `${siteUrl}#organization` },
      inLanguage: "en",
    },
    ...services.map((service) => ({
      "@type": "Service",
      name: service.title,
      description: service.copy,
      provider: { "@id": `${siteUrl}#organization` },
      url: `${siteUrl}#services`,
    })),
  ],
};

const benefits = [
  "Result-driven strategies that bring real business growth",
  "Creative, modern and conversion-focused solutions",
  "Transparent communication and on-time delivery",
  "A dedicated team that cares about your success",
];

const stats = [
  { icon: BriefcaseBusiness, value: "50+", label: "Projects Completed" },
  { icon: Smile, value: "30+", label: "Happy Clients" },
  { icon: Trophy, value: "5+", label: "Years of Experience" },
  { icon: Globe2, value: "5+", label: "Countries Served" },
];

const process = [
  { icon: SearchCheck, title: "Discover", copy: "We understand your goals, audience and requirements." },
  { icon: ClipboardList, title: "Plan", copy: "We create a strategic plan tailored to your business." },
  { icon: Code2, title: "Build", copy: "Our experts design, develop and create with precision." },
  { icon: Rocket, title: "Launch", copy: "We test everything and launch for maximum impact." },
  { icon: LineChart, title: "Grow", copy: "We analyze, optimize and scale your business growth." },
];

function SectionHeading({ eyebrow, children, centered = false, inverse = false }: { eyebrow: string; children: React.ReactNode; centered?: boolean; inverse?: boolean }) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : ""}>
      <p className={`text-xs font-extrabold uppercase tracking-[0.28em] ${inverse ? "text-cyan-300" : "text-blue-600"}`}>{eyebrow}</p>
      <h2 className={`mt-4 text-4xl font-black leading-[0.98] tracking-[-0.045em] sm:text-5xl ${inverse ? "text-white" : "text-slate-950"}`}>{children}</h2>
    </div>
  );
}

export default async function MarketingPage() {
  const { blogPosts, workPosts } = await getHomepageContent();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd).replace(/</g, "\\u003c") }} />
      <MarketingHero />

      <section id="about" className="scroll-mt-28 bg-white py-14 sm:py-20">
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal className="relative grid gap-8 overflow-hidden rounded-[2rem] border border-blue-100 bg-[radial-gradient(circle_at_top_right,#dbeafe,transparent_30rem),#f8fbff] p-5 shadow-[0_30px_90px_rgba(37,99,235,0.08)] sm:rounded-[2.5rem] sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
            <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-blue-100/70 blur-3xl" />
            <div className="relative"><p className="text-xs font-extrabold uppercase tracking-[0.28em] text-blue-600">Who We Are</p><h2 className="mt-4 max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl">A senior digital team that thinks in outcomes, not deliverables.</h2><p className="mt-5 max-w-3xl text-sm font-semibold leading-8 text-slate-600 sm:text-base">M&amp;W Labs brings developers, marketers, designers, and strategists together as one focused team. From the first strategy session to launch and beyond, every decision connects creative quality to measurable growth.</p></div>
            <div className="relative flex flex-col gap-3 sm:flex-row lg:flex-col"><Link href="#enquiry" className="button-primary inline-flex items-center justify-center rounded-xl px-7 py-4 text-sm font-extrabold">Work With Us <Rocket className="ml-3 size-4" /></Link><Link href="#services" className="button-secondary inline-flex items-center justify-center rounded-xl px-7 py-4 text-sm font-extrabold">Explore Capabilities <Users className="ml-3 size-4" /></Link></div>
          </Reveal>
        </div>
      </section>

      <section id="services" className="relative scroll-mt-24 overflow-hidden bg-brand-ink py-20 text-white sm:py-28">
        <div className="absolute -left-28 top-12 size-96 rounded-full bg-blue-600/15 blur-[110px]" /><div className="absolute -right-36 bottom-0 size-[30rem] rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal><SectionHeading eyebrow="Capabilities / 01—06" centered inverse>One studio. Every discipline needed to <span className="text-gradient-light">move forward.</span></SectionHeading></Reveal>
          <div className="mt-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {services.map(({ icon: Icon, title, copy, tone }, index) => (
              <Reveal key={title} delay={index * 0.04} className="h-full">
                <article className="tilt-card group relative flex h-full min-h-72 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-7 backdrop-blur transition hover:border-cyan-300/35 hover:bg-white/[0.075]">
                  <span className="absolute right-6 top-5 text-5xl font-black tracking-[-0.08em] text-white/[0.055]">0{index + 1}</span>
                  <span className={`grid size-14 place-items-center rounded-2xl shadow-2xl ${tone}`}><Icon className="size-6" /></span>
                  <h3 className="mt-7 text-2xl font-black leading-snug tracking-[-0.025em] text-white">{title}</h3>
                  <p className="mt-4 flex-1 text-sm font-semibold leading-7 text-slate-400">{copy}</p>
                  <Link href="#enquiry" className="mt-7 inline-flex items-center text-sm font-extrabold text-cyan-300">Discuss this capability <ArrowRight className="ml-2 size-4 transition group-hover:translate-x-1" /></Link>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="why" className="scroll-mt-24 bg-[linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)] py-20 sm:py-28">
        <div className="mx-auto grid max-w-[104rem] gap-10 px-4 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:px-12 2xl:px-16">
          <Reveal>
            <SectionHeading eyebrow="Why Choose M&W Labs?">We Don’t Just Deliver Services,<br />We Build <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Growth Systems.</span></SectionHeading>
            <div className="mt-7 space-y-4">{benefits.map((benefit) => <div key={benefit} className="flex items-start gap-3 text-sm font-bold text-slate-600"><span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/25"><Check className="size-3.5" /></span>{benefit}</div>)}</div>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row"><Link href="#about" className="button-primary inline-flex items-center justify-center rounded-xl px-7 py-4 text-sm font-extrabold">Meet the Studio <ArrowRight className="ml-3 size-4" /></Link><Link href="#enquiry" className="button-secondary inline-flex items-center justify-center rounded-xl px-7 py-4 text-sm font-extrabold">Get Growth Advice <Lightbulb className="ml-3 size-4" /></Link></div>
          </Reveal>
          <Reveal delay={0.08} className="space-y-6">
            <div className="grid gap-3 rounded-[1.75rem] border border-blue-100 bg-white p-4 shadow-[0_30px_80px_rgba(37,99,235,0.08)] sm:grid-cols-2 xl:grid-cols-4">{stats.map(({ icon: Icon, value, label }) => <div key={label} className="flex items-center gap-4 rounded-2xl p-3 transition hover:bg-blue-50/70"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600"><Icon className="size-5" /></span><div><p className="text-3xl font-black tracking-[-0.04em] text-slate-950">{value}</p><p className="text-xs font-bold text-slate-500">{label}</p></div></div>)}</div>
            <div className="grid overflow-hidden rounded-[2rem] border border-blue-100 bg-slate-50 shadow-[0_30px_90px_rgba(15,23,42,0.08)] md:grid-cols-[0.42fr_0.58fr]">
              <div className="relative flex min-h-64 items-end justify-center overflow-hidden bg-gradient-to-br from-blue-50 to-white p-6"><div className="absolute inset-0 opacity-50 [background-image:radial-gradient(circle,#dbeafe_1px,transparent_1.4px)] [background-size:14px_14px]" /><div className="relative grid size-40 place-items-center rounded-full border-[14px] border-white bg-gradient-to-br from-blue-600 to-cyan-400 text-white shadow-2xl"><Users className="size-14" /></div></div>
              <div className="flex flex-col justify-center p-7 sm:p-10"><MessageSquareQuote className="size-9 text-blue-200" /><blockquote className="mt-4 text-lg font-bold leading-8 text-slate-700">M&amp;W Labs transformed our online presence completely. Their team is professional, creative, and delivers outstanding results!</blockquote><div className="mt-7"><p className="font-black text-slate-950">David Smith</p><p className="text-sm font-semibold text-slate-500">CEO, TechFlow</p></div></div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="bg-white py-6 sm:py-10">
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal><GrowthSystemShowcase /></Reveal>
        </div>
      </section>

      <section id="work" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading eyebrow="Recent work">Digital experiences designed to <span className="text-gradient">perform.</span></SectionHeading>
            <div className="max-w-md"><p className="text-sm font-semibold leading-7 text-slate-500">The latest published case studies from our studio, managed directly from the M&amp;W Command workspace.</p><Link href="/work" className="mt-4 inline-flex items-center text-sm font-extrabold text-blue-700">Explore all case studies <ArrowRight className="ml-2 size-4" /></Link></div>
          </Reveal>
          {workPosts.length ? (
            <div className="mt-12 grid gap-7 lg:grid-cols-2">
              {workPosts.map((project, index) => <Reveal key={project.id} delay={index * 0.08}><article className="group overflow-hidden rounded-[2rem] border border-blue-100 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] transition duration-500 hover:-translate-y-2 hover:shadow-[0_40px_100px_rgba(37,99,235,0.16)]"><ContentCover image={project.coverImage} label={project.title} className="aspect-video" /><div className="p-7 sm:p-8"><div className="flex flex-wrap items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.18em] text-emerald-600"><span className="relative size-2 rounded-full bg-emerald-500"><span className="absolute inset-0 animate-ping rounded-full bg-emerald-400" /></span>Published{project.industry ? ` · ${project.industry}` : ""}{project.featured ? " · Featured" : ""}</div><h3 className="mt-4 text-3xl font-black tracking-[-0.035em] text-slate-950 transition group-hover:text-blue-700">{project.title}</h3>{project.clientName && <p className="mt-2 text-sm font-bold text-blue-600">{project.clientName}</p>}<p className="mt-4 text-sm font-semibold leading-7 text-slate-600">{project.summary}</p><Link href={`/work/${project.slug}`} className="mt-7 inline-flex items-center text-sm font-extrabold text-blue-600">View case study <ArrowRight className="ml-2 size-4 transition group-hover:translate-x-1" /></Link></div></article></Reveal>)}
            </div>
          ) : (
            <Reveal className="mt-12 rounded-[2rem] border border-dashed border-blue-200 bg-blue-50/55 p-10 text-center"><Sparkles className="mx-auto size-8 text-blue-500" /><h3 className="mt-4 text-2xl font-black text-slate-950">New case studies are being prepared.</h3><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600">Our newest project stories and measurable outcomes will appear here soon.</p></Reveal>
          )}
          <Reveal className="mt-10 flex justify-center"><Link href="/work" className="button-primary inline-flex items-center justify-center rounded-xl px-8 py-4 text-sm font-extrabold">View All Recent Work <ArrowRight className="ml-3 size-4" /></Link></Reveal>
        </div>
      </section>

      <section id="process" className="scroll-mt-24 overflow-hidden bg-[linear-gradient(180deg,#ffffff_0%,#eff6ff_100%)] py-20 sm:py-28">
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal><SectionHeading eyebrow="Process / Clarity at every step">How an idea becomes <span className="text-gradient">impact.</span></SectionHeading></Reveal>
          <div className="relative mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-5 lg:gap-0">
            {process.map(({ icon: Icon, title, copy }, index) => <Reveal key={title} delay={index * 0.06} className="group relative rounded-2xl bg-white p-4 lg:p-0 lg:pr-7"><div className="relative z-10 flex items-start gap-4"><span className="grid size-16 shrink-0 place-items-center rounded-full border border-blue-100 bg-white text-blue-600 shadow-[0_18px_45px_rgba(37,99,235,0.12)] ring-8 ring-blue-50/70 transition group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white"><Icon className="size-6" /></span><div className="pt-1"><div className="flex items-center gap-3"><p className="text-sm font-black text-blue-600">0{index + 1}</p><h3 className="font-black text-slate-950">{title}</h3></div><p className="mt-4 max-w-[12rem] text-sm font-semibold leading-7 text-slate-600">{copy}</p></div></div>{index < process.length - 1 && <div className="pointer-events-none absolute left-[5rem] top-8 hidden w-[calc(100%-5rem)] border-t-2 border-dashed border-blue-100 lg:block"><ArrowRight className="absolute -right-1 -top-2 size-4 text-blue-500" /></div>}</Reveal>)}
          </div>
          <Reveal className="mt-10 text-center"><Link href="/book" className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-white px-7 py-4 text-sm font-extrabold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-50">Start With a Discovery Call <CalendarCheck2 className="ml-3 size-4" /></Link></Reveal>
        </div>
      </section>

      <section id="enquiry" className="relative isolate scroll-mt-24 overflow-hidden bg-white py-20 sm:py-28">
        <div className="absolute left-0 top-24 -z-10 size-72 rounded-full bg-blue-100/60 blur-3xl" /><div className="absolute bottom-12 right-0 -z-10 size-80 rounded-full bg-cyan-100/55 blur-3xl" />
        <div className="mx-auto grid max-w-[104rem] gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-12 2xl:px-16">
          <Reveal>
            <SectionHeading eyebrow="Start Your Enquiry">Tell us what you want to build, market, or automate.</SectionHeading>
            <p className="mt-5 max-w-xl text-base font-semibold leading-8 text-slate-600">Use the quick form and we’ll route your request into our CRM, prefill discovery scheduling, and keep every confirmed next step visible in your client workspace.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[{ icon: MousePointerClick, title: "Quick intake", copy: "Share the essentials in under two minutes." }, { icon: CalendarCheck2, title: "Instant scheduling", copy: "Choose a discovery time without waiting for email." }, { icon: ShieldCheck, title: "Connected portal", copy: "Bookings and next steps stay in one secure workflow." }].map(({ icon: Icon, title, copy }) => <div key={title} className="rounded-2xl border border-blue-100 bg-white/80 p-5 shadow-sm backdrop-blur"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><Icon className="size-5" /></span><p className="mt-4 text-sm font-black text-slate-950">{title}</p><p className="mt-2 text-xs font-semibold leading-5 text-slate-500">{copy}</p></div>)}
            </div>
          </Reveal>
          <Reveal delay={0.08}><ProjectEnquiryForm /></Reveal>
        </div>
      </section>

      <section id="insights" className="scroll-mt-24 bg-[radial-gradient(circle_at_top_right,#eff6ff,transparent_28rem),linear-gradient(180deg,#ffffff_0%,#f8fbff_100%)] py-20 sm:py-28">
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><SectionHeading eyebrow="Latest insights">Ideas for building smarter, stronger businesses.</SectionHeading><p className="mt-4 max-w-2xl text-sm font-semibold leading-8 text-slate-600 sm:text-base">Freshly published thinking on product, marketing, branding, automation, and sustainable agency growth.</p></div><Link href="/blog" className="button-secondary inline-flex items-center justify-center rounded-xl px-6 py-3.5 text-sm font-extrabold">Browse all articles <ArrowRight className="ml-3 size-4" /></Link></Reveal>
          {blogPosts.length ? (
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{blogPosts.map((post, index) => <Reveal key={post.id} delay={index * 0.06}><article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-100/70"><ContentCover image={post.coverImage} label={post.title} className="aspect-[16/9]" /><div className="flex flex-1 flex-col p-5 sm:p-6"><div className="flex flex-wrap items-center gap-2 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] text-blue-600"><span>{post.category}</span>{post.featured && <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700">Featured</span>}</div><h3 className="mt-3 text-xl font-black leading-snug text-slate-950 transition group-hover:text-blue-700">{post.title}</h3><p className="mt-3 flex-1 text-sm font-semibold leading-7 text-slate-600">{post.excerpt || "Read the latest perspective from the M&W Labs studio."}</p><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><span className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-500">{post.publishedAt ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(post.publishedAt) : post.authorName}</span><Link href={`/blog/${post.slug}`} className="inline-flex items-center text-xs font-extrabold text-blue-700">Read article <ArrowRight className="ml-2 size-3.5 transition group-hover:translate-x-1" /></Link></div></div></article></Reveal>)}</div>
          ) : (
            <Reveal className="mt-10 rounded-[2rem] border border-dashed border-blue-200 bg-white p-10 text-center"><Lightbulb className="mx-auto size-8 text-blue-500" /><h3 className="mt-4 text-2xl font-black text-slate-950">New insights are being prepared.</h3><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-7 text-slate-600">Fresh thinking from the M&amp;W Labs studio will appear here soon.</p></Reveal>
          )}
        </div>
      </section>

      <section id="testimonials" className="scroll-mt-24 bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-[104rem] px-4 sm:px-6 lg:px-12 2xl:px-16">
          <Reveal><SectionHeading eyebrow="What Clients Say">Real People. Real <span className="bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">Results.</span></SectionHeading></Reveal>
          <Reveal delay={0.08}><TestimonialsCarousel /></Reveal>
          <Reveal className="relative mt-14 overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-500 px-7 py-12 text-white shadow-[0_36px_100px_rgba(37,99,235,0.24)] sm:px-12 lg:px-16 lg:py-16">
            <div className="absolute left-0 top-0 h-full w-40 opacity-20 [background-image:radial-gradient(circle,white_1px,transparent_1px)] [background-size:12px_12px]" /><div className="absolute -right-20 -top-24 size-72 rounded-full bg-cyan-300/30 blur-3xl" /><Send className="absolute right-14 top-1/2 hidden size-24 -translate-y-1/2 text-white/75 lg:block" />
            <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:pr-36"><div><p className="text-sm font-extrabold text-blue-100">Ready to Grow Your Business?</p><h3 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Let&apos;s Build Something Amazing Together!</h3><p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-blue-50">Book a free strategy call and let&apos;s discuss how we can help you grow.</p></div><div className="flex flex-col gap-4 sm:flex-row"><Link href="/book" className="inline-flex items-center justify-center rounded-xl bg-white px-7 py-4 text-sm font-extrabold text-blue-700 shadow-xl transition hover:-translate-y-0.5 hover:bg-blue-50">Book a Free Call <CalendarCheck2 className="ml-3 size-4" /></Link><Link href="#enquiry" className="inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-7 py-4 text-sm font-extrabold text-white backdrop-blur hover:bg-white/20">Request a Quote <ArrowRight className="ml-3 size-4" /></Link></div></div>
          </Reveal>
        </div>
      </section>

      <MarketingReception />
    </>
  );
}
