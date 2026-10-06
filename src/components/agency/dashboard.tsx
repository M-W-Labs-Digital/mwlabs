import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  Check,
  CircleAlert,
  CircleDollarSign,
  Plus,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";

import { RevenueChart } from "@/components/agency/revenue-chart";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type DashboardData = {
  asOf: string;
  metrics: {
    weightedPipeline: number;
    paidRevenue: number;
    receivables: number;
    grossMargin: number;
    activeClients: number;
    activeProjects: number;
  };
  pipelineByStage: { stage: string; count: number; value: number }[];
  revenueSeries: { month: string; revenue: number; target: number }[];
  signals: { title: string; message: string; href: string; tone: string }[];
  projects: {
    id: string;
    name: string;
    code: string;
    status: string;
    progress: number;
    budget: number;
    spent: number;
    dueDate: string | null;
    client: { company: string };
  }[];
  tasks: {
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate: string | null;
    project: { code: string } | null;
  }[];
};

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="admin-metric-card">
      <div className="flex items-start justify-between">
        <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold tracking-[-0.045em]">{value}</p></div>
        <span className="grid size-8 place-items-center rounded-lg bg-muted"><Icon className="size-4 text-muted-foreground" /></span>
      </div>
      <p className="mt-4 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

export function Dashboard({ data, firstName, role = "owner", customer = false }: { data: DashboardData; firstName: string; role?: string; customer?: boolean }) {
  const { metrics } = data;
  const isAdmin = role === "owner" || role === "admin";
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(data.asOf));
  const primaryActionHref = customer ? "/register?new=1" : isAdmin ? "/app/leads" : "/app/tasks";

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500" />{dateLabel}</div>
          <h1 className="admin-page-title">Welcome back, {firstName}.</h1>
          <p className="admin-page-description">{customer ? "Track your requests, active work, and account finance from one secure workspace." : isAdmin ? "Here&apos;s the shape of the agency and where your attention has the most leverage." : "See the work, priorities, and delivery signals that need your attention."}</p>
        </div>
        <div className="admin-actions">
          <Button nativeButton={false} render={<Link href={customer ? "/book" : !isAdmin ? "/app/tasks" : "/app/calendar"} />} variant="outline" className="h-9 bg-white"><CalendarClock className="size-4" /> {customer ? "Book a meeting" : !isAdmin ? "My work" : "This week"}</Button>
          <Button nativeButton={false} render={<Link href={primaryActionHref} />} className="h-9"><Plus className="size-4" /> {customer ? "New request" : isAdmin ? "New lead" : "Open tasks"}</Button>
        </div>
      </div>

      <div className="admin-metrics mt-7">
        <MetricCard label={customer ? "Request value" : isAdmin ? "Weighted pipeline" : "Active projects"} value={customer || isAdmin ? money.format(metrics.weightedPipeline) : `${metrics.activeProjects}`} detail={customer ? `${data.pipelineByStage.reduce((sum, stage) => sum + stage.count, 0)} project requests` : isAdmin ? `${data.pipelineByStage.reduce((sum, item) => sum + item.count, 0)} open opportunities` : "Projects currently in flight"} icon={WalletCards} />
        <MetricCard label={customer ? "Paid with M&W" : isAdmin ? "Revenue collected" : "Open tasks"} value={customer || isAdmin ? money.format(metrics.paidRevenue) : `${data.tasks.length}`} detail={customer || isAdmin ? "Paid invoices in the workspace" : "Priorities assigned to your team"} icon={CircleDollarSign} />
        <MetricCard label={customer ? "Outstanding" : isAdmin ? "Gross margin" : "Delivery signals"} value={customer ? money.format(metrics.receivables) : isAdmin ? `${metrics.grossMargin.toFixed(1)}%` : `${data.signals.length}`} detail={customer ? "Invoices awaiting payment" : isAdmin ? "Paid revenue less recorded expenses" : "Updates requiring attention"} icon={TrendingUp} />
        <MetricCard label={customer ? "Active projects" : "Active relationships"} value={`${customer ? metrics.activeProjects : metrics.activeClients}`} detail={customer ? "Projects currently in flight" : `${metrics.activeProjects} projects in flight`} icon={UsersRound} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_0.85fr]">
        {(isAdmin || customer) && <section className="admin-card rounded-2xl p-4 sm:p-6">
          <div><p className="text-sm font-semibold">Revenue pulse</p><p className="mt-1 text-xs text-muted-foreground">Collected revenue over the last six calendar months</p></div>
          <div className="mt-4"><RevenueChart data={data.revenueSeries} /></div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2 border-t pt-4 text-[11px] text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2 rounded-full bg-blue-600" />Paid invoice revenue</span><span className="font-semibold text-foreground sm:ml-auto">Receivables {money.format(metrics.receivables)}</span></div>
        </section>}

        <section className="relative overflow-hidden rounded-2xl bg-brand-navy p-6 text-white shadow-[0_18px_45px_rgba(21,93,252,0.18)]">
          <div className="absolute -right-16 -top-16 size-52 rounded-full border border-accent/20"><div className="absolute inset-9 rounded-full border border-white/8" /></div>
          <div className="relative">
            <div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-accent text-accent-foreground"><BrainCircuit className="size-4" /></span><Badge className="border-0 bg-white/8 text-[9px] uppercase tracking-[0.13em] text-white/50">Live brief</Badge></div>
            <h2 className="mt-6 text-xl font-semibold tracking-[-0.03em]">Three signals worth your attention.</h2>
            <div className="mt-5 space-y-3">{data.signals.map((signal) => <Link key={signal.title} href={signal.href} className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3.5 transition hover:bg-white/8"><span className={cn("mt-0.5 grid size-6 shrink-0 place-items-center rounded-lg", signal.tone === "warning" ? "bg-orange-400/12 text-orange-300" : signal.tone === "cash" ? "bg-sky-400/12 text-sky-300" : "bg-accent/15 text-accent")}>{signal.tone === "warning" ? <CircleAlert className="size-3" /> : signal.tone === "cash" ? <CircleDollarSign className="size-3" /> : <Sparkles className="size-3" />}</span><div><p className="text-xs font-semibold">{signal.title}</p><p className="mt-1 text-[11px] leading-5 text-white/45">{signal.message}</p></div></Link>)}</div>
            <Button nativeButton={false} render={<Link href={customer ? "/register?new=1" : isAdmin ? "/app/ai" : "/app/tasks"} />} className="mt-5 h-9 w-full bg-accent text-xs text-accent-foreground hover:bg-accent/90">{customer ? "Submit another request" : isAdmin ? "Open command brief" : "Open my tasks"} <ArrowRight className="size-3.5" /></Button>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="admin-card rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">Projects in motion</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Budget, progress, and next deadline</p></div>{!customer && <Button nativeButton={false} render={<Link href="/app/projects" />} variant="ghost" className="shrink-0 text-xs">View all <ArrowUpRight className="size-3.5" /></Button>}</div>
          <div className="divide-y">
            {data.projects.length ? data.projects.map((project, index) => {
              const burn = project.budget ? (project.spent / project.budget) * 100 : 0;
              return (
                <div key={project.id} className="grid gap-4 px-4 py-4 sm:grid-cols-[1fr_120px_100px] sm:items-center sm:px-5">
                  <div className="flex items-center gap-3"><Avatar className="size-9 rounded-xl"><AvatarFallback className={cn("rounded-xl text-[10px] font-semibold", ["bg-blue-100 text-blue-800", "bg-cyan-100 text-cyan-800", "bg-brand-navy text-blue-50"][index % 3])}>{project.client.company.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar><div><p className="text-sm font-semibold">{project.name}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{project.client.company} · {project.code}</p></div></div>
                  <div><div className="mb-1.5 flex justify-between text-[10px]"><span className="text-muted-foreground">Progress</span><span className="font-semibold">{project.progress}%</span></div><Progress value={project.progress} /></div>
                  <div className="text-left sm:text-right"><p className={cn("text-xs font-semibold", burn > 85 && "text-orange-700")}>{burn.toFixed(0)}% burn</p><p className="mt-1 text-[10px] text-muted-foreground">{money.format(project.spent)} spent</p></div>
                </div>
              );
            }) : <div className="p-6 text-sm font-medium text-muted-foreground">No active projects yet. Your project work will appear here as soon as an engagement begins.</div>}
          </div>
        </section>

        <section className="admin-card rounded-2xl">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-5"><div><h2 className="text-sm font-semibold">Today&apos;s focus</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Open commitments across your team</p></div>{!customer && <Button nativeButton={false} render={<Link href="/app/tasks" />} variant="ghost" className="shrink-0 text-xs">All tasks <ArrowUpRight className="size-3.5" /></Button>}</div>
          <div className="divide-y px-4 sm:px-5">
            {data.tasks.length ? data.tasks.map((task) => (
              <Link href="/app/tasks" key={task.id} className="flex items-start gap-3 py-3.5"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border"><Check className="size-3 text-muted-foreground" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{task.title}</p><div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground"><span>{task.project?.code ?? "OPS"}</span><span>·</span><span>{task.status}</span></div></div><span className={cn("rounded-full px-2 py-1 text-[9px] font-semibold", task.priority === "High" || task.priority === "Urgent" ? "bg-red-50 text-red-700" : task.priority === "Medium" ? "bg-orange-50 text-orange-700" : "bg-muted text-muted-foreground")}>{task.priority}</span></Link>
            )) : <div className="p-6 text-sm font-medium text-muted-foreground">No open tasks right now. You&apos;re all caught up.</div>}
          </div>
        </section>
      </div>

      {(isAdmin || customer) && <section className="admin-card mt-5 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Pipeline movement</h2><p className="mt-0.5 text-[11px] text-muted-foreground">Value and deal count by commercial stage</p></div>{isAdmin && <Button nativeButton={false} render={<Link href="/app/leads" />} variant="ghost" className="shrink-0 text-xs">Open CRM <ArrowUpRight className="size-3.5" /></Button>}</div>
        <div className="mt-5 grid gap-2 min-[480px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
          {data.pipelineByStage.map((stage, index) => (
            <div key={stage.stage} className="rounded-xl border bg-muted/25 p-3.5"><div className="flex items-center justify-between"><span className="font-mono text-[9px] text-muted-foreground">0{index + 1}</span><span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold shadow-sm">{stage.count}</span></div><p className="mt-4 text-xs font-semibold">{stage.stage}</p><p className="mt-1 text-lg font-semibold tracking-[-0.03em]">{money.format(stage.value)}</p><div className="mt-3 h-1 rounded-full bg-blue-100"><div className="h-full rounded-full bg-[linear-gradient(90deg,#155dfc,#02d1fa)]" style={{ width: `${Math.min(100, 24 + index * 16)}%` }} /></div></div>
          ))}
        </div>
      </section>}
    </div>
  );
}
