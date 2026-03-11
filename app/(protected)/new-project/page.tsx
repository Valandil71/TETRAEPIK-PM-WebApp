"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo, Suspense } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RouteId } from "@/lib/roleAccess";
import { getUserFriendlyError } from "@/utils/toastHelpers";
import type { Project } from "@/types/project";

function NewProjectPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const duplicateFromId = searchParams.get("duplicateFrom");
  const queryClient = useQueryClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // Fetch source project if duplicating
  const { data: sourceProject, isLoading: loadingSource } = useQuery({
    queryKey: queryKeys.project(duplicateFromId),
    queryFn: async (): Promise<Project | null> => {
      if (!duplicateFromId) return null;

      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", parseInt(duplicateFromId))
        .single();

      if (error) {
        throw new Error(`Failed to fetch project: ${error.message}`);
      }

      return data;
    },
    enabled: !!duplicateFromId,
  });

  // Get the closest deadline from the source project
  const getClosestDeadline = (project: Project | null): string => {
    if (!project) return "";
    const deadlines = [
      project.initial_deadline,
      project.interim_deadline,
      project.final_deadline,
    ].filter(Boolean) as string[];

    if (deadlines.length === 0) return "";

    const validDates = deadlines
      .map((d) => new Date(d))
      .filter((d) => !isNaN(d.getTime()));

    if (validDates.length === 0) return "";

    return new Date(Math.min(...validDates.map((d) => d.getTime())))
      .toISOString()
      .split("T")[0];
  };

  // Initialize form data
  const initialFormData = useMemo(() => {
    if (sourceProject) {
      return {
        name: `${sourceProject.name} (Copy)`,
        system: sourceProject.system || "B0X",
        words: sourceProject.words || 0,
        lines: sourceProject.lines || 0,
        dueDate: getClosestDeadline(sourceProject),
        instructions: sourceProject.instructions || "",
        sourceLanguage: sourceProject.language_in || "",
        targetLanguage: sourceProject.language_out || "",
      };
    }
    return {
      name: "",
      system: "B0X",
      words: 0,
      lines: 0,
      dueDate: "",
      instructions: "",
      sourceLanguage: "",
      targetLanguage: "",
    };
  }, [sourceProject]);

  const [formData, setFormData] = useState(initialFormData);

  // Update form data when source project loads
  useEffect(() => {
    if (sourceProject) {
      const timeout = setTimeout(() => {
        setFormData({
          name: `${sourceProject.name} (Copy)`,
          system: sourceProject.system || "B0X",
          words: sourceProject.words || 0,
          lines: sourceProject.lines || 0,
          dueDate: getClosestDeadline(sourceProject),
          instructions: sourceProject.instructions || "",
          sourceLanguage: sourceProject.language_in || "",
          targetLanguage: sourceProject.language_out || "",
        });
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [sourceProject]);

  // Check if data has changed from source project
  const hasDataChanged = useMemo(() => {
    if (!duplicateFromId || !sourceProject) return true;

    const sourceDeadline = getClosestDeadline(sourceProject);
    return (
      formData.name !== `${sourceProject.name} (Copy)` ||
      formData.system !== (sourceProject.system || "B0X") ||
      formData.words !== (sourceProject.words || 0) ||
      formData.lines !== (sourceProject.lines || 0) ||
      formData.dueDate !== sourceDeadline ||
      formData.instructions !== (sourceProject.instructions || "") ||
      formData.sourceLanguage !== (sourceProject.language_in || "") ||
      formData.targetLanguage !== (sourceProject.language_out || "")
    );
  }, [formData, sourceProject, duplicateFromId]);

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Convert dueDate to timestamp
      const deadline =
        data.dueDate ? new Date(data.dueDate).toISOString() : null;

      const projectData = {
        name: data.name,
        system: data.system,
        words: data.words || null,
        lines: data.lines || null,
        final_deadline: deadline,
        instructions: data.instructions || null,
        language_in: data.sourceLanguage || null,
        language_out: data.targetLanguage || null,
        status: "active" as const,
      };

      const { data: newProject, error } = await supabase
        .from("projects")
        .insert(projectData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create project: ${error.message}`);
      }

      return newProject;
    },
    onSuccess: (newProject) => {
      queryClient.invalidateQueries({
        queryKey: ["projects-with-translators"],
      });
      queryClient.invalidateQueries({
        queryKey: ["projects"],
      });
      toast.success("Project created successfully");
      router.push(`/project/${newProject.id}`);
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "project creation"));
    },
  });

  const handleSave = () => {
    // Validation
    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    if (!formData.system) {
      toast.error("System is required");
      return;
    }

    // If duplicating, check if data has changed
    if (duplicateFromId && !hasDataChanged) {
      toast.error(
        "Please modify at least one field before creating a new project"
      );
      return;
    }

    createProjectMutation.mutate(formData);
  };

  const handleCancel = () => {
    router.back();
  };

  if (loadingSource) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading project data...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={handleCancel}
          className="inline-flex cursor-pointer items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 transition-colors mb-4"
          type="button"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <h1 className="text-gray-900 dark:text-white mb-2">
          {duplicateFromId ? "Duplicate Project" : "New Project"}
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          {duplicateFromId ?
            "Create a new project based on existing project details"
          : "Create a new translation project"}
        </p>
      </div>

      {/* Form */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
        <div className="space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project name"
            />
          </div>

          {/* System */}
          <div>
            <label htmlFor="system-select" className="block text-gray-700 dark:text-gray-300 mb-2">
              System
            </label>
            <select
              id="system-select"
              value={formData.system}
              onChange={(e) =>
                setFormData({ ...formData, system: e.target.value })
              }
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="B0X">B0X</option>
              <option value="XTM">XTM</option>
              <option value="SSE">SSE</option>
              <option value="STM">STM</option>
              <option value="LAT">LAT</option>
            </select>
          </div>

          {/* Words and Lines */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Word Count
              </label>
              <input
                type="number"
                value={formData.words}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    words: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Line Count
              </label>
              <input
                type="number"
                value={formData.lines}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    lines: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min="0"
              />
            </div>
          </div>

          {/* Languages */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Source Language
              </label>
              <input
                type="text"
                value={formData.sourceLanguage}
                onChange={(e) =>
                  setFormData({ ...formData, sourceLanguage: e.target.value })
                }
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. English"
              />
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2">
                Target Language
              </label>
              <input
                type="text"
                value={formData.targetLanguage}
                onChange={(e) =>
                  setFormData({ ...formData, targetLanguage: e.target.value })
                }
                className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Spanish"
              />
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label htmlFor="due-date" className="block text-gray-700 dark:text-gray-300 mb-2">
              Due Date
            </label>
            <input
              id="due-date"
              type="date"
              value={formData.dueDate}
              onChange={(e) =>
                setFormData({ ...formData, dueDate: e.target.value })
              }
              className="w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2">
              Instructions
            </label>
            <textarea
              value={formData.instructions}
              onChange={(e) =>
                setFormData({ ...formData, instructions: e.target.value })
              }
              className="w-full h-32 px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Enter project instructions..."
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleCancel}
            disabled={createProjectMutation.isPending}
            className="px-6 py-3 cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 rounded-lg transition-colors border border-gray-200 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              createProjectMutation.isPending ||
              !!(duplicateFromId && !hasDataChanged)
            }
            className="inline-flex cursor-pointer items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            type="button"
          >
            {createProjectMutation.isPending ?
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creating...
              </>
            : <>
                <Save className="w-5 h-5" />
                Save New Project
              </>
            }
          </button>
        </div>

        {duplicateFromId && !hasDataChanged && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-2 text-right">
            Please modify at least one field before creating a new project
          </p>
        )}
      </div>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <RoleGuard routeId={RouteId.NEW_PROJECT}>
      <Suspense
        fallback={
          <div className="flex justify-center items-center h-screen">
            <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
          </div>
        }
      >
        <NewProjectPageContent />
      </Suspense>
    </RoleGuard>
  );
}
