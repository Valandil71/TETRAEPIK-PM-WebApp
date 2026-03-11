import type { ProjectWithTranslators } from "@/types/project";
import { format } from "date-fns";

/** Serialize a cell value as RFC 4180-compliant CSV field. */
function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Quote if contains comma, double-quote, or newline
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return format(new Date(value), "yyyy-MM-dd");
  } catch {
    return value;
  }
}

function formatArray(value: string[] | null | undefined): string {
  if (!value || value.length === 0) return "";
  return value.join(" | ");
}

const COLUMNS: { header: string; get: (p: ProjectWithTranslators) => unknown }[] = [
  { header: "Name",             get: (p) => p.name },
  { header: "System",           get: (p) => p.system },
  { header: "Project Type",     get: (p) => p.project_type ?? "" },
  { header: "Status",           get: (p) => p.status },
  { header: "Initial Deadline", get: (p) => formatDate(p.initial_deadline) },
  { header: "Final Deadline",   get: (p) => formatDate(p.final_deadline) },
  { header: "Words",            get: (p) => p.words ?? "" },
  { header: "Lines",            get: (p) => p.lines ?? "" },
  { header: "Hours",            get: (p) => p.hours ?? "" },
  { header: "Paid",             get: (p) => p.paid === true ? "Yes" : p.paid === false ? "No" : "" },
  { header: "Invoiced",         get: (p) => p.invoiced === true ? "Yes" : p.invoiced === false ? "No" : "" },
  { header: "Language In",      get: (p) => p.language_in },
  { header: "Language Out",     get: (p) => p.language_out },
  { header: "SAP PM",           get: (p) => p.sap_pm ?? "" },
  { header: "Terminology Key",  get: (p) => formatArray(p.terminology_key) },
  { header: "LXE Project",      get: (p) => formatArray(p.lxe_project) },
  { header: "Translation Area", get: (p) => formatArray(p.translation_area) },
  { header: "LXE Projects",     get: (p) => formatArray(p.lxe_projects) },
  { header: "Work List",        get: (p) => formatArray(p.work_list) },
  { header: "Graph ID",         get: (p) => formatArray(p.graph_id) },
  { header: "Project Notes",    get: (p) => p.project_notes ?? "" },
];

export function buildProjectsCsv(projects: ProjectWithTranslators[]): string {
  const header = COLUMNS.map((c) => csvField(c.header)).join(",");
  const rows = projects.map((p) =>
    COLUMNS.map((c) => csvField(c.get(p))).join(",")
  );
  return [header, ...rows].join("\r\n");
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
