"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { buildProjectsCsv, downloadCsv } from "@/utils/exportProjectsCsv";
import { useSupabase } from "@/hooks/core/useSupabase";
import type { ProjectWithTranslators } from "@/types/project";
import { format } from "date-fns";
import { toast } from "sonner";

type ExportScope = "all" | "active" | "complete";

const SCOPE_OPTIONS: { id: ExportScope; label: string; description: string }[] =
  [
    {
      id: "all",
      label: "All Projects",
      description: "Active and completed projects",
    },
    {
      id: "active",
      label: "Active Projects",
      description: "Only currently active projects",
    },
    {
      id: "complete",
      label: "Completed Projects",
      description: "Only completed projects",
    },
  ];

interface ExportProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportProjectsDialog({
  open,
  onOpenChange,
}: ExportProjectsDialogProps) {
  const supabase = useSupabase();
  const [scope, setScope] = useState<ExportScope>("all");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let query = supabase
        .from("projects")
        .select("*")
        .order("final_deadline", { ascending: true });

      if (scope !== "all") {
        query = query.eq("status", scope);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      // Projects from this query have no translators — attach empty array to satisfy type
      const rows = (data ?? []) as Omit<
        ProjectWithTranslators,
        "translators"
      >[];
      const projects: ProjectWithTranslators[] = rows.map((p) => ({
        ...p,
        translators: [],
      }));

      if (projects.length === 0) {
        toast.info("No projects found for the selected filter.");
        return;
      }

      const csv = buildProjectsCsv(projects);
      const filename = `projects_${scope}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      downloadCsv(csv, filename);
      toast.success(
        `Exported ${projects.length} project${projects.length !== 1 ? "s" : ""}`,
      );
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (isExporting) return;
    if (!next) setScope("all");
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <FileDown className="w-5 h-5 text-blue-500" />
            <DialogTitle>Export Projects to CSV</DialogTitle>
          </div>
          <DialogDescription className="pt-1">
            Choose which projects to include in the export.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {SCOPE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setScope(option.id)}
              className={[
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all",
                scope === option.id
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-500"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700",
              ].join(" ")}
            >
              {/* Custom radio dot */}
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-current">
                {scope === option.id && (
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                )}
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {option.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 mr-2" />
                Export CSV
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
