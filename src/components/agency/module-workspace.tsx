"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Download, Edit3, ExternalLink, FileSpreadsheet, FileUp, ImageIcon, LoaderCircle, Plus, Search, Sparkles, Trash2, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { type CrudField, type CrudUiConfig, crudModuleConfigs, crudWorkspaceViews } from "@/lib/crud-config";
import type { ModuleConfig } from "@/lib/module-config";
import { cn } from "@/lib/utils";

type CrudRecord = Record<string, unknown> & { id: string };
type RelationOption = { id: string; label: string };
type RelationOptions = Record<string, RelationOption[]>;
type CrudPage = { limit: number; total: number; hasMore: boolean; nextCursor: string | null };

type LiveMetric = {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "warning" | "neutral";
};

function recordLabel(resource: string, record: CrudRecord) {
  const value = record.company ?? record.name ?? record.title ?? record.number ?? record.description ?? record.email ?? record.id;
  const qualifier = resource === "leads" && record.name ? ` — ${record.name}` : "";
  return `${String(value)}${qualifier}`;
}

function inputDate(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function inputDateTime(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatCell(value: unknown, format?: "currency" | "date" | "datetime" | "percent" | "boolean", currency = "USD") {
  if (value === null || value === undefined || value === "") return "—";
  if (format === "currency") return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value));
  if (format === "date") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
  }
  if (format === "datetime") {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }
  if (format === "percent") return `${Number(value)}%`;
  if (format === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function csvCell(value: unknown) {
  const normalized = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  return /[",\n\r]/.test(normalized) ? `"${normalized.replaceAll('"', '""')}"` : normalized;
}

function parseCsv(source: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  return rows;
}

function spreadsheetCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

async function parseImportFile(file: File) {
  const xlsx = file.name.toLowerCase().endsWith(".xlsx") || file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (xlsx) {
    const { readSheet } = await import("read-excel-file/browser");
    const rows = await readSheet(file, { trim: true });
    return rows.map((row) => row.map(spreadsheetCell));
  }
  if (file.name.toLowerCase().endsWith(".csv") || ["text/csv", "application/csv", "application/vnd.ms-excel", ""].includes(file.type)) {
    return parseCsv(await file.text());
  }
  throw new Error("Choose a CSV or XLSX spreadsheet.");
}

function liveMetrics(records: CrudRecord[], crud: CrudUiConfig, now: number, total: number): LiveMetric[] {
  const terminal = new Set(["complete", "completed", "done", "paid", "accepted", "signed", "active", "published", "archived", "ended"]);
  const attention = new Set(["blocked", "overdue", "urgent", "at risk", "rejected", "no show", "failed"]);
  const statuses = records.map((record) => String(record.status ?? record.stage ?? "").toLowerCase());
  const open = statuses.filter((status) => status && !terminal.has(status)).length;
  const needsAttention = records.filter((record) => {
    const status = String(record.status ?? record.stage ?? record.priority ?? "").toLowerCase();
    if (attention.has(status)) return true;
    const due = record.dueDate ?? record.validUntil ?? record.renewalDate ?? record.nextActivityAt;
    return Boolean(due && new Date(String(due)).getTime() < now && !terminal.has(status));
  }).length;
  const valueKey = ["total", "amount", "value", "monthlyValue", "subtotal"].find((key) => records.some((record) => typeof record[key] === "number"));
  const totalValue = valueKey ? records.reduce((sum, record) => sum + Number(record[valueKey] ?? 0), 0) : null;
  const publication = records.some((record) => ["Published", "Draft", "Archived"].includes(String(record.status)));
  const metrics: LiveMetric[] = [
    { label: `Total ${crud.resource.replaceAll("-", " ")}`, value: String(total), detail: "Live workspace records" },
    publication
      ? { label: "Published on page", value: String(records.filter((record) => record.status === "Published").length), detail: `${records.filter((record) => record.status === "Draft").length} drafts on this page`, tone: "positive" }
      : { label: "Open on page", value: String(open), detail: "Visible non-terminal records" },
    { label: "Attention on page", value: String(needsAttention), detail: needsAttention ? "Visible overdue or risk-marked" : "No visible flags", tone: needsAttention ? "warning" : "positive" },
  ];
  if (totalValue !== null) metrics.push({ label: "Recorded value", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(totalValue), detail: `Sum of ${valueKey} in workspace reporting currency` });
  else metrics.push({ label: "Updated", value: records[0]?.updatedAt || records[0]?.createdAt ? formatCell(records[0].updatedAt ?? records[0].createdAt, "date") : "—", detail: "Most recent record" });
  return metrics;
}

function ImageUploadControl({ field, initial }: { field: CrudField; initial?: CrudRecord }) {
  const id = `${field.key}-${initial?.id ?? "new"}`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(initial?.[field.key] ? String(initial[field.key]) : "");
  const [uploading, setUploading] = useState(false);
  const previewable = value.startsWith("/") || /^https?:\/\//i.test(value);

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    inputRef.current?.setCustomValidity("Please wait for the image upload to finish.");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.url) throw new Error(result?.error ?? "The image could not be uploaded.");
      setValue(String(result.url));
      toast.success("Image uploaded", { description: "The new image is ready to save with this content." });
    } catch (error) {
      toast.error("Image upload failed", { description: error instanceof Error ? error.message : "Choose another image and try again." });
    } finally {
      setUploading(false);
      inputRef.current?.setCustomValidity("");
      event.target.value = "";
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-muted/20">
      <div
        role="img"
        aria-label={value ? `${field.label} preview` : "No image selected"}
        style={previewable ? { backgroundImage: `linear-gradient(rgb(2 6 24 / 0.06), rgb(2 6 24 / 0.06)), url(${JSON.stringify(value)})` } : undefined}
        className="relative grid aspect-[16/6] place-items-center bg-[linear-gradient(135deg,#eff6ff,#f8fafc_55%,#ecfeff)] bg-cover bg-center"
      >
        {!previewable && <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto size-7 text-blue-400" /><p className="mt-2 text-[11px] font-medium">Upload a JPG, PNG, WebP, or AVIF image</p></div>}
        {uploading && <div className="absolute inset-0 grid place-items-center bg-white/80 backdrop-blur-sm"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-blue-600" /><p className="mt-2 text-[11px] font-semibold text-slate-600">Uploading image…</p></div></div>}
      </div>
      <div className="space-y-2 border-t bg-white p-3">
        <Input
          ref={inputRef}
          id={id}
          name={field.key}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required={field.required}
          placeholder={field.placeholder}
          className="bg-white"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={`${id}-upload`} className={cn("inline-flex h-8 cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-3 text-[11px] font-semibold text-white shadow-sm transition hover:bg-blue-700", uploading && "pointer-events-none opacity-60")}>
            <UploadCloud className="mr-2 size-3.5" />{value ? "Replace image" : "Upload image"}
          </label>
          <input id={`${id}-upload`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={uploadImage} disabled={uploading} className="sr-only" />
          {value && <button type="button" onClick={() => setValue("")} className="inline-flex h-8 items-center rounded-lg px-3 text-[11px] font-semibold text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"><X className="mr-1.5 size-3.5" />Remove</button>}
          <span className="ml-auto text-[10px] text-muted-foreground">Maximum 8 MB</span>
        </div>
      </div>
    </div>
  );
}

function FieldControl({ field, initial, relations }: { field: CrudField; initial?: CrudRecord; relations: RelationOptions }) {
  const id = `${field.key}-${initial?.id ?? "new"}`;
  const initialValue = initial?.[field.key];

  if (field.type === "image") {
    return <ImageUploadControl field={field} initial={initial} />;
  }

  if (field.type === "textarea") {
    return <Textarea id={id} name={field.key} defaultValue={initialValue ? String(initialValue) : ""} required={field.required} placeholder={field.placeholder} rows={field.rows ?? 4} className="min-h-24 resize-y" />;
  }

  if (field.type === "select" || field.type === "relation") {
    const relationOptions = field.relationResource ? relations[field.relationResource] ?? [] : [];
    const options = field.type === "relation" ? relationOptions.map((option) => ({ value: option.id, label: option.label })) : (field.options ?? []).map((option) => ({ value: option, label: option }));
    return (
      <select key={`${id}-${options.map((option) => option.value).join("|")}`} id={id} name={field.key} required={field.required} defaultValue={initialValue ? String(initialValue) : field.required ? options[0]?.value ?? "" : ""} className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition focus:border-ring focus:ring-[3px] focus:ring-ring/20">
        {!field.required && <option value="">None</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (field.type === "checkbox") {
    return (
      <label htmlFor={id} className="flex h-9 cursor-pointer items-center gap-3 rounded-lg border border-input px-3 text-sm">
        <input id={id} name={field.key} type="checkbox" defaultChecked={initialValue === undefined ? Boolean(field.defaultChecked) : Boolean(initialValue)} className="size-4 accent-blue-600" />
        <span>{field.checkboxLabel ?? "Enabled"}</span>
      </label>
    );
  }

  return (
    <Input
      id={id}
      name={field.key}
      type={field.type === "date" ? "date" : field.type === "datetime" ? "datetime-local" : field.type}
      defaultValue={field.type === "date" ? inputDate(initialValue) : field.type === "datetime" ? inputDateTime(initialValue) : initialValue === null || initialValue === undefined ? "" : String(initialValue)}
      required={field.required}
      placeholder={field.placeholder}
      min={field.min}
      max={field.max}
      step={field.step}
    />
  );
}

function RecordDialog({ crud, initial, relations, onSaved, trigger }: { crud: CrudUiConfig; initial?: CrudRecord; relations: RelationOptions; onSaved: (record: CrudRecord) => void; trigger: React.ReactElement }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const formId = useId();
  const editing = Boolean(initial);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = new FormData(event.currentTarget);
    const data: Record<string, unknown> = {};
    for (const field of crud.fields) {
      const value = form.get(field.key);
      if (field.type === "checkbox") data[field.key] = value === "on";
      else if (field.type === "number" && value !== "") data[field.key] = Number(value);
      else if (field.type === "datetime" && typeof value === "string" && value) data[field.key] = new Date(value).toISOString();
      else data[field.key] = value ?? "";
    }

    try {
      const response = await fetch(`/api/crud/${crud.resource}`, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: initial?.id, data }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? `Unable to save ${crud.singular}`);
      onSaved(result.record as CrudRecord);
      window.dispatchEvent(new Event("mwlabs:notifications-changed"));
      setOpen(false);
      toast.success(editing ? `${crud.singular} updated` : `${crud.singular} created`, {
        description: typeof result.workflow === "string" ? result.workflow : undefined,
      });
    } catch (error) {
      toast.error(`Could not save ${crud.singular}`, { description: error instanceof Error ? error.message : "Try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className={cn("admin-scrollbar max-h-[92dvh] overflow-y-auto p-4 sm:p-6", crud.fields.some((field) => (field.rows ?? 0) > 8) ? "sm:max-w-4xl" : "sm:max-w-2xl")}>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${crud.singular}` : `Create ${crud.singular}`}</DialogTitle>
          <DialogDescription>{editing ? "Update the record and keep the workspace source of truth current." : "Add a live record to this agency workspace."}</DialogDescription>
        </DialogHeader>
        <form id={formId} onSubmit={submit} className="grid gap-4 py-1 sm:grid-cols-2 sm:py-2">
          {crud.fields.map((field) => (
            <div key={field.key} className={cn("space-y-2", ["textarea", "image"].includes(field.type) && "sm:col-span-2")}>
              <Label htmlFor={`${field.key}-${initial?.id ?? "new"}`}>{field.label}{field.required && <span className="ml-1 text-destructive">*</span>}</Label>
              <FieldControl field={field} initial={initial} relations={relations} />
              {crud.publicRoute && field.key === "status" && <p className="text-[10px] leading-5 text-muted-foreground">Only Published content appears on the website. Leave the publish date empty to make it live immediately; a future date schedules it.</p>}
            </div>
          ))}
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form={formId} disabled={pending}>{pending ? <><LoaderCircle className="size-4 animate-spin" /> Saving…</> : <><Check className="size-4" /> {editing ? "Save changes" : `Create ${crud.singular}`}</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ crud, onImported }: { crud: CrudUiConfig; onImported: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);

  // No static template: imports are treated dynamically so any spreadsheet columns are accepted.

  async function importFile() {
    if (!file) return;
    setPending(true);
    setProgress(0);
    try {
      if (file.size > 8 * 1024 * 1024) throw new Error("Choose a spreadsheet smaller than 8 MB.");
      const rows = await parseImportFile(file);
      if (rows.length < 2) throw new Error("Add at least one data row below the spreadsheet header.");
      if (rows.length > 501) throw new Error("Import up to 500 records at a time.");
      const headers = rows[0].map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim());
      const allowed = new Map(crud.fields.map((field) => [field.key, field]));

      const prepared: Record<string, unknown>[] = [];
      const failures: string[] = [];
      for (let index = 1; index < rows.length; index += 1) {
        const values = rows[index];
        const data: Record<string, unknown> = {};
        headers.forEach((header, column) => {
          const field = allowed.get(header);
          const value = values[column]?.trim() ?? "";
          if (!field) {
            // Unknown columns are kept as raw values
            data[header] = value;
            return;
          }
          if (field.type === "number") data[header] = value === "" ? "" : Number(value);
          else if (field.type === "checkbox") data[header] = ["true", "yes", "1", "on"].includes(value.toLowerCase());
          else if (field.type === "datetime" && value) data[header] = new Date(value).toISOString();
          else data[header] = value;
        });
        prepared.push(data);
      }
      let imported = 0;
      const batchSize = 25;
      for (let offset = 0; offset < prepared.length; offset += batchSize) {
        const batch = prepared.slice(offset, offset + batchSize);
        const response = await fetch(`/api/crud/${crud.resource}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: batch }),
        });
        const result = await response.json().catch(() => null);
        if (!response.ok && response.status !== 207) throw new Error(result?.error ?? `Import stopped after ${imported} records.`);
        imported += Array.isArray(result?.records) ? result.records.length : 0;
        for (const failure of Array.isArray(result?.failures) ? result.failures : []) {
          failures.push(`row ${offset + Number(failure.index) + 2}: ${failure.error ?? "save failed"}`);
        }
        setProgress(Math.round(Math.min(prepared.length, offset + batch.length) / prepared.length * 100));
      }
      if (imported) onImported();
      if (failures.length) throw new Error(`${imported} imported; ${failures.length} failed. ${failures.slice(0, 3).join(" · ")}`);
      window.dispatchEvent(new Event("mwlabs:notifications-changed"));
      toast.success(`${imported} ${crud.resource.replaceAll("-", " ")} imported`);
      setOpen(false);
      setFile(null);
    } catch (error) {
      toast.error("Import could not finish", { description: error instanceof Error ? error.message : "Check the spreadsheet and try again." });
    } finally {
      setPending(false);
      setProgress(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="h-9 bg-white"><FileSpreadsheet className="size-4" /> Import</Button>} />
      <DialogContent className="admin-scrollbar max-h-[92dvh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle>Import {crud.resource.replaceAll("-", " ")}</DialogTitle>
          <DialogDescription>Upload CSV or XLSX. Columns are mapped dynamically; extra columns are recorded as-is.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex w-full items-center justify-between rounded-xl border bg-muted/25 p-4 text-left"><span><span className="block text-sm font-semibold">Dynamic import</span><span className="mt-1 block text-xs text-muted-foreground">No template required — all columns will be recorded.</span></span><Download className="size-4 text-blue-600" /></div>
          <Label htmlFor={`spreadsheet-${crud.resource}`}>Completed spreadsheet</Label>
          <Input id={`spreadsheet-${crud.resource}`} type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <p className="text-[11px] leading-5 text-muted-foreground">CSV and XLSX are supported. XLSX imports the first worksheet. Up to 500 records are validated and saved in bounded batches so the workspace remains responsive.</p>
          {pending && <div className="space-y-2"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-blue-600 transition-[width]" style={{ width: `${progress}%` }} /></div><p className="text-right text-[10px] font-semibold text-blue-700">{progress}% processed</p></div>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={() => void importFile()} disabled={!file || pending}>{pending ? <><LoaderCircle className="size-4 animate-spin" /> Importing…</> : <><FileUp className="size-4" /> Import records</>}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ModuleWorkspace({ moduleKey, config, role }: { moduleKey: string; config: ModuleConfig; role: string }) {
  const views = crudWorkspaceViews[moduleKey] ?? (crudModuleConfigs[moduleKey] ? [crudModuleConfigs[moduleKey]!] : []);
  const [activeResource, setActiveResource] = useState(views[0]?.resource ?? "");
  const crud = views.find((view) => view.resource === activeResource) ?? views[0];
  const canWrite = Boolean(crud && (["owner", "admin"].includes(role) || ["tasks", "calendar-events", "time-entries", "documents", "activities", "knowledge"].includes(crud.resource)));
  const canDelete = ["owner", "admin"].includes(role);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [records, setRecords] = useState<CrudRecord[]>([]);
  const [relations, setRelations] = useState<RelationOptions>({});
  const [loading, setLoading] = useState(Boolean(crud));
  const [page, setPage] = useState<CrudPage>({ limit: 50, total: 0, hasMore: false, nextCursor: null });
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setCursorHistory([]);
      setDebouncedQuery(query.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!crud) return;
    let active = true;
    const controller = new AbortController();
    const cursor = cursorHistory.at(-1);

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (cursor) params.set("cursor", cursor);
        const recordResponse = await fetch(`/api/crud/${crud.resource}?${params}`, { signal: controller.signal });
        if (!recordResponse.ok) throw new Error("Could not load this workspace.");
        const recordResult = await recordResponse.json();
        if (!active) return;
        setRecords(recordResult.records as CrudRecord[]);
        setPage(recordResult.page as CrudPage);
      } catch (error) {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) toast.error("Live records unavailable", { description: error instanceof Error ? error.message : "Refresh and try again." });
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; controller.abort(); };
  }, [crud, cursorHistory, debouncedQuery, refreshKey]);

  useEffect(() => {
    if (!crud) return;
    let active = true;
    const controller = new AbortController();
    const resources = Array.from(new Set(crud.fields.map((field) => field.relationResource).filter((resource): resource is string => Boolean(resource))));
    async function loadRelations() {
      const responses = await Promise.all(resources.map((resource) => fetch(resource === "members" ? "/api/team" : `/api/crud/${resource}?limit=100&lookup=1`, { signal: controller.signal })));
      const results = await Promise.all(responses.map(async (response) => response.ok ? response.json() : { records: [] }));
      if (!active) return;
      setRelations(Object.fromEntries(resources.map((resource, index) => {
        const result = results[index];
        if (resource === "members") {
          return [resource, ((result.members ?? []) as Array<{ userId: string; name: string; email: string }>).map((member) => ({ id: member.userId, label: `${member.name} — ${member.email}` }))];
        }
        return [resource, (result.records as CrudRecord[]).map((record) => ({ id: record.id, label: recordLabel(resource, record) }))];
      })));
    }
    void loadRelations().catch((error) => {
      if (active && !(error instanceof DOMException && error.name === "AbortError")) toast.error("Related records unavailable");
    });
    return () => { active = false; controller.abort(); };
  }, [crud]);

  const filteredRecords = records;
  const filteredRows = useMemo(() => config.rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [config.rows, query]);
  const metrics = crud ? liveMetrics(records, crud, mountedAt, page.total) : config.metrics;
  const attentionCount = Number(metrics.find((metric) => metric.label === "Attention on page")?.value ?? 0);
  const operatingGuide = crud
    ? attentionCount > 0
      ? `${attentionCount} ${attentionCount === 1 ? "record needs" : "records need"} attention based on status or due date. Review those before adding new work.`
      : `${page.total} live ${crud.resource.replaceAll("-", " ")} ${page.total === 1 ? "record is" : "records are"} connected to this workspace. This page has no immediate status or due-date flags.`
    : config.insight;

  function saveRecord(record: CrudRecord) {
    setRecords((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : current);
    if (!records.some((item) => item.id === record.id)) {
      setCursorHistory([]);
      setRefreshKey((value) => value + 1);
    }
  }

  function importRecords() {
    setCursorHistory([]);
    setRefreshKey((value) => value + 1);
  }

  function exportRecords() {
    if (!crud) return;
    const recordKeys = filteredRecords.flatMap((r) => Object.keys(r));
    const keys = Array.from(new Set(["id", ...crud.fields.map((field) => field.key), "createdAt", "updatedAt", ...recordKeys]));
    const lines = [keys.map(csvCell).join(","), ...filteredRecords.map((record) => keys.map((key) => csvCell(record[key])).join(","))];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    link.download = `${crud.resource}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`${filteredRecords.length} visible records exported`);
  }

  async function deleteRecord(record: CrudRecord) {
    if (!crud || !window.confirm(`Delete this ${crud.singular}? This action cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/crud/${crud.resource}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to delete record");
      setRecords((current) => current.filter((item) => item.id !== record.id));
      setPage((current) => ({ ...current, total: Math.max(0, current.total - 1) }));
      window.dispatchEvent(new Event("mwlabs:notifications-changed"));
      toast.success(`${crud.singular} deleted`);
    } catch (error) {
      toast.error(`Could not delete ${crud.singular}`, { description: error instanceof Error ? error.message : "Try again." });
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.17em] text-muted-foreground">{config.eyebrow}</p>{crud && <Badge variant="outline" className="rounded-full bg-emerald-50 text-[8px] font-semibold text-emerald-700">Live CRUD</Badge>}</div>
          <h1 className="admin-page-title">{config.title}</h1>
          <p className="admin-page-description">{config.description}</p>
        </div>
        <div className="admin-actions">
          {crud && <Button variant="outline" className="h-9 bg-white" onClick={exportRecords}><Download className="size-4" /> Export page</Button>}
          {crud && canWrite && <ImportDialog crud={crud} onImported={importRecords} />}
          {crud && canWrite && <RecordDialog crud={crud} relations={relations} onSaved={saveRecord} trigger={<Button className="h-9"><Plus className="size-4" /> Create {crud.singular}</Button>} />}
        </div>
      </div>

      {views.length > 1 && (
        <div className="admin-scrollbar mt-6 flex gap-1 overflow-x-auto rounded-xl border bg-white p-1 shadow-sm">
          {views.map((view) => <button key={view.resource} type="button" onClick={() => { setActiveResource(view.resource); setQuery(""); setDebouncedQuery(""); setCursorHistory([]); }} className={cn("whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold capitalize text-muted-foreground transition hover:bg-muted", crud?.resource === view.resource && "bg-brand-navy text-white hover:bg-brand-navy")}>{view.resource.replaceAll("-", " ")}</button>)}
        </div>
      )}

      <div className="admin-metrics mt-7">
        {metrics.map((metric) => (
          <div key={metric.label} className="admin-metric-card">
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p><p className="mt-3 text-2xl font-semibold tracking-[-0.045em]">{metric.value}</p><p className={cn("mt-3 text-[11px] text-muted-foreground", metric.tone === "positive" && "text-emerald-700", metric.tone === "warning" && "text-orange-700")}>{metric.detail}</p>
          </div>
        ))}
      </div>

      <section className="admin-card mt-5 overflow-hidden rounded-2xl">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this workspace…" className="h-8.5 bg-muted/45 pl-9 text-xs" /></div>
          <p className="text-[11px] text-muted-foreground">Showing {crud ? `${filteredRecords.length} of ${page.total}` : filteredRows.length} {query ? "matching" : "total"} records</p>
        </div>
        <div className="admin-mobile-records">
          {loading && <div className="grid min-h-40 place-items-center rounded-xl border border-dashed bg-muted/20 text-center"><div><LoaderCircle className="mx-auto size-5 animate-spin text-blue-600" /><p className="mt-2 text-xs text-muted-foreground">Loading live records…</p></div></div>}
          {!loading && crud && filteredRecords.map((record) => {
            const primaryColumn = crud.columns[0];
            const primaryValue = primaryColumn ? formatCell(record[primaryColumn.key], primaryColumn.format, typeof record.currency === "string" ? record.currency : "USD") : recordLabel(crud.resource, record);
            return (
              <article key={record.id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_8px_24px_rgba(1,22,69,0.04)]">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{primaryValue}</p><p className="mt-1 text-[10px] font-medium uppercase tracking-[0.11em] text-muted-foreground">{crud.singular}</p></div>{record.status || record.stage ? <Badge variant="outline" className="shrink-0 rounded-full bg-blue-50 text-[9px] font-semibold text-blue-700">{String(record.status ?? record.stage)}</Badge> : null}</div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-blue-50 pt-4">
                  {crud.columns.slice(1, 5).map((column) => {
                    const relationResource = crud.fields.find((field) => field.key === column.key)?.relationResource;
                    const relationLabel = relationResource ? relations[relationResource]?.find((option) => option.id === String(record[column.key]))?.label : null;
                    return <div key={column.key} className="min-w-0"><dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{column.label}</dt><dd className="mt-1 truncate text-xs font-medium text-slate-700">{relationLabel ?? formatCell(record[column.key], column.format, typeof record.currency === "string" ? record.currency : "USD")}</dd></div>;
                  })}
                </dl>
                {(canWrite || crud.publicRoute) && <div className="mt-4 flex gap-2 border-t border-blue-50 pt-3">
                  {crud.publicRoute && record.status === "Published" && typeof record.slug === "string" && <Button nativeButton={false} render={<a href={crud.publicRoute === "root" ? `/${record.slug}` : `/${crud.publicRoute}/${record.slug}`} target="_blank" rel="noreferrer" />} variant="outline" size="sm" className="flex-1"><ExternalLink className="size-3.5" /> View</Button>}
                  {canWrite && <RecordDialog crud={crud} initial={record} relations={relations} onSaved={saveRecord} trigger={<Button variant="outline" size="sm" className="flex-1"><Edit3 className="size-3.5" /> Edit</Button>} />}
                  {canDelete && <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => void deleteRecord(record)}><Trash2 className="size-3.5" /> Delete</Button>}
                </div>}
              </article>
            );
          })}
          {!loading && crud && filteredRecords.length === 0 && <div className="grid min-h-40 place-items-center rounded-xl border border-dashed bg-muted/20 px-5 text-center text-xs text-muted-foreground">No records found.{canWrite ? ` Create the first ${crud.singular} to get started.` : ""}</div>}
          {!loading && !crud && filteredRows.map((row, index) => <article key={`${Object.values(row)[0]}-${index}`} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><p className="truncate text-sm font-semibold">{String(row[config.columns[0]] ?? "Record")}</p><dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-4">{config.columns.slice(1, 5).map((column) => <div key={column} className="min-w-0"><dt className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{column}</dt><dd className="mt-1 truncate text-xs text-slate-700">{row[column]}</dd></div>)}</dl></article>)}
        </div>
        <div className="admin-desktop-table admin-scrollbar overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {(crud?.columns ?? config.columns.map((label) => ({ key: label, label }))).map((column) => <TableHead key={column.key} className="h-10 whitespace-nowrap bg-muted/25 px-4 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{column.label}</TableHead>)}
                {crud && (canWrite || crud.publicRoute) && <TableHead className="sticky right-0 h-10 w-24 bg-muted/80 px-4 text-right text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={(crud?.columns.length ?? config.columns.length) + 1} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-blue-600" /><p className="mt-2 text-xs text-muted-foreground">Loading live records…</p></TableCell></TableRow>}
              {!loading && crud && filteredRecords.map((record) => (
                <TableRow key={record.id} className="h-14 hover:bg-muted/25">
                  {crud.columns.map((column, cellIndex) => {
                    const relationResource = crud.fields.find((field) => field.key === column.key)?.relationResource;
                    const relationLabel = relationResource ? relations[relationResource]?.find((option) => option.id === String(record[column.key]))?.label : null;
                    const value = relationLabel ?? formatCell(record[column.key], column.format, typeof record.currency === "string" ? record.currency : "USD");
                    return <TableCell key={column.key} className={cn("max-w-72 truncate whitespace-nowrap px-4 text-xs text-muted-foreground", cellIndex === 0 && "font-semibold text-foreground")}>{["status", "stage", "priority"].includes(column.key) ? <Badge variant="outline" className="rounded-full bg-muted/45 text-[9px] font-semibold">{value}</Badge> : value}</TableCell>;
                  })}
                  {(canWrite || crud.publicRoute) && <TableCell className="sticky right-0 bg-white px-3"><div className="flex justify-end gap-1">
                    {crud.publicRoute && record.status === "Published" && typeof record.slug === "string" && <Button nativeButton={false} render={<a href={crud.publicRoute === "root" ? `/${record.slug}` : `/${crud.publicRoute}/${record.slug}`} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" aria-label={`View published ${crud.singular}`}><ExternalLink className="size-3.5" /></Button>}
                    {canWrite && <RecordDialog crud={crud} initial={record} relations={relations} onSaved={saveRecord} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${crud.singular}`}><Edit3 className="size-3.5" /></Button>} />}{canDelete && <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:bg-rose-50 hover:text-rose-600" onClick={() => void deleteRecord(record)} aria-label={`Delete ${crud.singular}`}><Trash2 className="size-3.5" /></Button>}
                  </div></TableCell>}
                </TableRow>
              ))}
              {!loading && crud && filteredRecords.length === 0 && <TableRow><TableCell colSpan={crud.columns.length + ((canWrite || crud.publicRoute) ? 1 : 0)} className="h-32 text-center text-xs text-muted-foreground">No records found.{canWrite ? ` Create the first ${crud.singular} to get started.` : ""}</TableCell></TableRow>}
              {!crud && filteredRows.map((row, index) => (
                <TableRow key={`${Object.values(row)[0]}-${index}`} className="h-14 hover:bg-muted/25">{config.columns.map((column, cellIndex) => <TableCell key={column} className={cn("whitespace-nowrap px-4 text-xs text-muted-foreground", cellIndex === 0 && "font-semibold text-foreground")}>{column === "Status" || column === "Stage" || column === "Priority" ? <Badge variant="outline" className="rounded-full bg-muted/45 text-[9px] font-semibold">{row[column]}</Badge> : row[column]}</TableCell>)}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {crud && (cursorHistory.length > 0 || page.hasMore) && (
          <div className="flex items-center justify-between gap-3 border-t bg-muted/10 px-4 py-3">
            <p className="text-[10px] font-medium text-muted-foreground">Page {cursorHistory.length + 1} · {page.limit} records maximum</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={loading || cursorHistory.length === 0} onClick={() => setCursorHistory((current) => current.slice(0, -1))}><ChevronLeft className="size-3.5" /> Previous</Button>
              <Button variant="outline" size="sm" disabled={loading || !page.hasMore || !page.nextCursor} onClick={() => page.nextCursor && setCursorHistory((current) => [...current, page.nextCursor!])}>Next <ChevronRight className="size-3.5" /></Button>
            </div>
          </div>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.72fr]">
        <section className="admin-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Operating workflow</h2><p className="mt-1 text-[11px] text-muted-foreground">The complete lifecycle, visible to everyone responsible.</p></div><Badge variant="outline" className="text-[9px]">Configured</Badge></div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">{config.workflow.map((step, index) => <div key={step} className="relative rounded-xl bg-muted/45 p-3"><span className="font-mono text-[9px] text-muted-foreground">0{index + 1}</span><p className="mt-4 text-[11px] font-semibold leading-4">{step}</p>{index < config.workflow.length - 1 && <span className="absolute -right-2 top-1/2 z-10 hidden h-px w-2 bg-border xl:block" />}</div>)}</div>
        </section>
        <section className="relative overflow-hidden rounded-2xl bg-brand-navy p-5 text-white shadow-[0_18px_45px_rgba(21,93,252,0.16)]">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent"><Sparkles className="size-3.5" />M&amp;W operating guide</div><p className="mt-4 text-sm leading-6 text-white/70">{operatingGuide}</p><Button nativeButton={false} render={<Link href="/app/ai" />} variant="ghost" className="mt-4 h-8 bg-white/6 text-[11px] text-white hover:bg-white/10 hover:text-white">Ask a follow-up</Button>
        </section>
      </div>
    </div>
  );
}
