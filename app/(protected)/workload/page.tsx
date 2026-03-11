"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
import {
  Loader2,
  AlertCircle,
  Calendar,
  FileText,
  Type,
  Circle,
  Clock,
  CheckCircle2,
  XCircle,
  Users,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useUser } from "@/hooks/user/useUser";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { useUserWorkload } from "@/hooks/user/useUserWorkload";
import { RoleGuard } from "@/components/auth/RoleGuard";
import { RouteId } from "@/lib/roleAccess";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { DeadlineDisplay } from "@/components/general/DeadlineDisplay";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  format,
  isBefore,
  startOfDay,
  endOfDay,
  addDays,
  addWeeks,
  addMonths,
} from "date-fns";
import { countWorkingDays } from "@/lib/date-utils";

const HOURS_PER_WORKDAY = 8;
import { createBrowserClient } from "@supabase/ssr";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";
import { getUserFriendlyError } from "@/utils/toastHelpers";

type DatePreset = "today" | "3days" | "week" | "2weeks" | "month" | "custom";
type TabType = "byDate" | "byUser";

export default function WorkloadPage() {
  return (
    <RoleGuard routeId={RouteId.WORKLOAD}>
      <WorkloadContent />
    </RoleGuard>
  );
}

function WorkloadContent() {
  const { loading: userLoading } = useUser();
  const queryClient = useQueryClient();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables.");
  }

  const supabase = createBrowserClient(supabaseUrl, supabaseKey);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>("byDate");

  // State for By Date tab
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>("week");
  const [customDate, setCustomDate] = useState<string>("");

  // State for By User tab
  const [userDatePreset, setUserDatePreset] = useState<DatePreset>("month");
  const [userCustomDate, setUserCustomDate] = useState<string>("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // State for editing user rates
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editWordsPerHour, setEditWordsPerHour] = useState<string>("");
  const [editLinesPerHour, setEditLinesPerHour] = useState<string>("");

  // Fetch all projects
  const {
    data: projectsData = [],
    isLoading: projectsLoading,
    error: projectsError,
  } = useProjectsWithTranslators(false, true);

  // Fetch user workloads
  const { workloads, isLoading: workloadsLoading } = useUserWorkload();

  // Filter to only show active projects (not complete)
  const activeProjects = useMemo(
    () => projectsData.filter((p) => p.status !== "complete"),
    [projectsData]
  );

  // Get the target date based on selection
  const targetDate = useMemo(() => {
    const today = startOfDay(new Date());
    switch (selectedPreset) {
      case "today":
        return endOfDay(today);
      case "3days":
        return endOfDay(addDays(today, 3));
      case "week":
        return endOfDay(addWeeks(today, 1));
      case "2weeks":
        return endOfDay(addWeeks(today, 2));
      case "month":
        return endOfDay(addMonths(today, 1));
      case "custom":
        return customDate ? endOfDay(new Date(customDate)) : null;
      default:
        return endOfDay(addWeeks(today, 1));
    }
  }, [selectedPreset, customDate]);

  // Get final deadline for a project
  const getFinalDeadline = useCallback((project: (typeof activeProjects)[0]) => {
    if (!project.final_deadline) return null;
    const date = new Date(project.final_deadline);
    return isNaN(date.getTime()) ? null : date;
  }, []);

  // Filter projects by target date and calculate totals
  const workloadStats = useMemo(() => {
    if (!targetDate) {
      return { projects: [], totalWords: 0, totalLines: 0, projectCount: 0 };
    }

    const filteredProjects = activeProjects.filter((project) => {
      const deadline = getFinalDeadline(project);
      if (!deadline) return false;
      return (
        isBefore(deadline, targetDate) ||
        deadline.getTime() === targetDate.getTime()
      );
    });

    const totalWords = filteredProjects.reduce(
      (sum, p) => sum + (p.words || 0),
      0
    );
    const totalLines = filteredProjects.reduce(
      (sum, p) => sum + (p.lines || 0),
      0
    );

    return {
      projects: filteredProjects,
      totalWords,
      totalLines,
      projectCount: filteredProjects.length,
    };
  }, [activeProjects, targetDate, getFinalDeadline]);

  const datePresets: { id: DatePreset; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "3days", label: "3 Days" },
    { id: "week", label: "1 Week" },
    { id: "2weeks", label: "2 Weeks" },
    { id: "month", label: "1 Month" },
    { id: "custom", label: "Custom" },
  ];

  // Get status icon and label for translator assignment
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "claimed":
        return {
          icon: Clock,
          color: "text-blue-500",
          label: "In Progress",
        };
      case "done":
        return {
          icon: CheckCircle2,
          color: "text-green-500",
          label: "Done",
        };
      case "rejected":
        return {
          icon: XCircle,
          color: "text-red-500",
          label: "Rejected",
        };
      default: // unclaimed
        return {
          icon: Circle,
          color: "text-gray-400",
          label: "Unclaimed",
        };
    }
  };

  // Mutation to update user rates
  const updateRatesMutation = useMutation({
    mutationFn: async ({
      userId,
      wordsPerHour,
      linesPerHour,
    }: {
      userId: string;
      wordsPerHour: number;
      linesPerHour: number;
    }) => {
      const { error } = await supabase
        .from("users")
        .update({
          words_per_hour: wordsPerHour,
          lines_per_hour: linesPerHour,
        })
        .eq("id", userId);

      if (error) {
        throw new Error(`Failed to update rates: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users() });
      toast.success("Rates updated successfully");
      setEditingUserId(null);
    },
    onError: (error: Error) => {
      toast.error(getUserFriendlyError(error, "rate update"));
    },
  });

  const handleStartEdit = (
    userId: string,
    wordsPerHour: number,
    linesPerHour: number
  ) => {
    setEditingUserId(userId);
    setEditWordsPerHour(wordsPerHour.toString());
    setEditLinesPerHour(linesPerHour.toString());
  };

  const handleSaveEdit = (userId: string) => {
    const wordsPerHour = parseInt(editWordsPerHour) || 500;
    const linesPerHour = parseInt(editLinesPerHour) || 50;
    updateRatesMutation.mutate({ userId, wordsPerHour, linesPerHour });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditWordsPerHour("");
    setEditLinesPerHour("");
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  // Get target date for By User tab
  const userTargetDate = useMemo(() => {
    const today = startOfDay(new Date());
    switch (userDatePreset) {
      case "today":
        return endOfDay(today);
      case "3days":
        return endOfDay(addDays(today, 3));
      case "week":
        return endOfDay(addWeeks(today, 1));
      case "2weeks":
        return endOfDay(addWeeks(today, 2));
      case "month":
        return endOfDay(addMonths(today, 1));
      case "custom":
        return userCustomDate ? endOfDay(new Date(userCustomDate)) : null;
      default:
        return endOfDay(addMonths(today, 1));
    }
  }, [userDatePreset, userCustomDate]);

  // Convert workloads map to sorted array with filtered stats
  const workloadsArray = useMemo(() => {
    return Array.from(workloads.values())
      .filter((w) => w.projects.length > 0)
      .map((workload) => {
        // Calculate filtered stats based on userTargetDate
        let filteredWords = 0;
        let filteredLines = 0;
        let filteredEarliestDeadlineTime: number | null = null;

        workload.projects.forEach((project) => {
          const isWithinDate =
            !userTargetDate ||
            !project.deadline ||
            isBefore(project.deadline, userTargetDate) ||
            project.deadline.getTime() === userTargetDate.getTime();

          if (isWithinDate) {
            filteredWords += project.wordsShare;
            filteredLines += project.linesShare;
            if (project.deadline) {
              const projectDeadlineTime = project.deadline.getTime();
              if (
                filteredEarliestDeadlineTime === null ||
                projectDeadlineTime < filteredEarliestDeadlineTime
              ) {
                filteredEarliestDeadlineTime = projectDeadlineTime;
              }
            }
          }
        });

        const wordHours = filteredWords / workload.wordsPerHour;
        const lineHours = filteredLines / workload.linesPerHour;
        const filteredEstimatedHours =
          Math.round((wordHours + lineHours) * 10) / 10;

        // Convert back to Date for return value
        const filteredEarliestDeadline =
          filteredEarliestDeadlineTime !== null ?
            new Date(filteredEarliestDeadlineTime)
          : null;

        // Calculate feasibility based on filtered deadline using working days
        let filteredIsFeasible = true;
        if (filteredEarliestDeadlineTime !== null) {
          const now = new Date();
          const deadlineDate = new Date(filteredEarliestDeadlineTime);
          const workingDaysUntilDeadline = countWorkingDays(now, deadlineDate);
          const workingHoursUntilDeadline =
            workingDaysUntilDeadline * HOURS_PER_WORKDAY;
          filteredIsFeasible =
            filteredEstimatedHours <= workingHoursUntilDeadline;
        }

        return {
          ...workload,
          filteredWords,
          filteredLines,
          filteredEstimatedHours,
          filteredEarliestDeadline,
          filteredIsFeasible,
        };
      })
      .sort((a, b) => b.filteredEstimatedHours - a.filteredEstimatedHours);
  }, [workloads, userTargetDate]);

  // Loading state
  if (userLoading || projectsLoading || workloadsLoading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (projectsError) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <Card>
          <CardContent className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">
                Error Loading Projects
              </h2>
              <p className="text-muted-foreground">
                {projectsError.message ||
                  "An error occurred while loading projects."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-gray-900 dark:text-white mb-2">
          Workload Overview
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          View total word and line counts for projects and users
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab("byDate")}
            className={`pb-3 cursor-pointer border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "byDate" ?
                "border-blue-500 text-blue-500"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            type="button"
          >
            <Calendar className="w-4 h-4" />
            By Date
          </button>
          <button
            onClick={() => setActiveTab("byUser")}
            className={`pb-3 cursor-pointer border-b-2 transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === "byUser" ?
                "border-blue-500 text-blue-500"
              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
            type="button"
          >
            <Users className="w-4 h-4" />
            By User ({workloadsArray.length})
          </button>
        </div>
      </div>

      {/* By Date Tab Content */}
      {activeTab === "byDate" && (
        <>
          {/* Date Selection */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 items-center">
              {datePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset.id)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    selectedPreset === preset.id ?
                      "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500"
                  }`}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}

              {selectedPreset === "custom" && (
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {targetDate && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Showing workload until {format(targetDate, "MMMM d, yyyy")}
              </p>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Projects Count */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Projects
                    </p>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                      {workloadStats.projectCount}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Words */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Type className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Words
                    </p>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                      {workloadStats.totalWords.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Lines */}
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <svg
                      className="w-6 h-6 text-purple-600 dark:text-purple-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h10"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Total Lines
                    </p>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                      {workloadStats.totalLines.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Projects List */}
          {workloadStats.projects.length > 0 ?
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Project
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          System
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Translator(s)
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Deadline
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Words
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Lines
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadStats.projects.map((project) => {
                        return (
                          <tr
                            key={project.id}
                            className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                          >
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                              {project.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                              {project.system}
                            </td>
                            <td className="py-3 px-4">
                              {project.translators.length > 0 ?
                                <TooltipProvider>
                                  <div className="flex flex-wrap gap-2">
                                    {project.translators.map((translator) => {
                                      const statusInfo = getStatusIcon(
                                        translator.assignment_status
                                      );
                                      const StatusIcon = statusInfo.icon;
                                      return (
                                        <div
                                          key={translator.id}
                                          className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 text-xs"
                                        >
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <StatusIcon
                                                className={`w-3.5 h-3.5 ${statusInfo.color} shrink-0`}
                                              />
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>{statusInfo.label}</p>
                                            </TooltipContent>
                                          </Tooltip>
                                          <ProfileAvatar
                                            name={translator.name}
                                            avatar={translator.avatar}
                                            size="xs"
                                            showEditButton={false}
                                          />
                                          <span>
                                            {translator.short_name ||
                                              translator.name}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </TooltipProvider>
                              : <span className="text-gray-400 dark:text-gray-500 text-xs italic">
                                  Not assigned
                                </span>
                              }
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <DeadlineDisplay
                                initialDeadline={project.initial_deadline}
                                interimDeadline={project.interim_deadline}
                                finalDeadline={project.final_deadline}
                              />
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                              {(project.words || 0).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                              {project.lines || 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 dark:bg-gray-700/50">
                        <td
                          colSpan={4}
                          className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white"
                        >
                          Total
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          {workloadStats.totalWords.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white text-right">
                          {workloadStats.totalLines.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          : <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    {targetDate ?
                      "No projects found with deadlines until this date"
                    : "Select a date to view workload"}
                  </p>
                </div>
              </CardContent>
            </Card>
          }
        </>
      )}

      {/* By User Tab Content */}
      {activeTab === "byUser" && (
        <>
          {/* Date Selection for By User tab */}
          <div className="mb-8">
            <div className="flex flex-wrap gap-3 items-center">
              {datePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setUserDatePreset(preset.id)}
                  className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                    userDatePreset === preset.id ?
                      "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:border-blue-400 dark:hover:border-blue-500"
                  }`}
                  type="button"
                >
                  {preset.label}
                </button>
              ))}

              {userDatePreset === "custom" && (
                <input
                  type="date"
                  value={userCustomDate}
                  onChange={(e) => setUserCustomDate(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {userTargetDate && (
              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Counting workload for projects due until{" "}
                {format(userTargetDate, "MMMM d, yyyy")}
              </p>
            )}
          </div>

          {workloadsArray.length > 0 ?
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="w-8 py-3 px-2" />
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          User
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Words/Hour
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Lines/Hour
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Words
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Total Lines
                        </th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Est. Hours
                        </th>
                        <th className="text-center py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Status
                        </th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
                          Earliest Deadline
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {workloadsArray.map((workload) => {
                        const isEditing = editingUserId === workload.userId;
                        const isExpanded = expandedUsers.has(workload.userId);
                        return (
                          <Fragment key={workload.userId}>
                            <tr
                              className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                              onClick={() =>
                                toggleUserExpanded(workload.userId)
                              }
                            >
                              <td className="py-3 px-2 text-center">
                                <button
                                  type="button"
                                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleUserExpanded(workload.userId);
                                  }}
                                >
                                  {isExpanded ?
                                    <ChevronDown className="w-4 h-4" />
                                  : <ChevronRight className="w-4 h-4" />}
                                </button>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar
                                    name={workload.userName}
                                    avatar={workload.avatar}
                                    size="sm"
                                    showEditButton={false}
                                  />
                                  <div>
                                    <p className="text-sm text-gray-900 dark:text-white">
                                      {workload.userName}
                                    </p>
                                    {workload.shortName && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {workload.shortName}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td
                                className="py-3 px-4 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isEditing ?
                                  <input
                                    type="number"
                                    value={editWordsPerHour}
                                    onChange={(e) =>
                                      setEditWordsPerHour(e.target.value)
                                    }
                                    className="w-20 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                    min="1"
                                  />
                                : <button
                                    onClick={() =>
                                      handleStartEdit(
                                        workload.userId,
                                        workload.wordsPerHour,
                                        workload.linesPerHour
                                      )
                                    }
                                    className="text-sm text-gray-900 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                                    type="button"
                                  >
                                    {workload.wordsPerHour}
                                  </button>
                                }
                              </td>
                              <td
                                className="py-3 px-4 text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isEditing ?
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      value={editLinesPerHour}
                                      onChange={(e) =>
                                        setEditLinesPerHour(e.target.value)
                                      }
                                      className="w-20 px-2 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                      min="1"
                                    />
                                    <button
                                      onClick={() =>
                                        handleSaveEdit(workload.userId)
                                      }
                                      disabled={updateRatesMutation.isPending}
                                      className="p-1 text-green-600 hover:text-green-700 hover:scale-125 transition-transform disabled:opacity-50"
                                      type="button"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      className="p-1 text-red-600 hover:text-red-700 hover:scale-125 transition-transform"
                                      type="button"
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </button>
                                  </div>
                                : <button
                                    onClick={() =>
                                      handleStartEdit(
                                        workload.userId,
                                        workload.wordsPerHour,
                                        workload.linesPerHour
                                      )
                                    }
                                    className="text-sm text-gray-900 dark:text-white hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer"
                                    type="button"
                                  >
                                    {workload.linesPerHour}
                                  </button>
                                }
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                                {workload.filteredWords.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                                {workload.filteredLines.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right font-medium">
                                {workload.filteredEstimatedHours}h
                              </td>
                              <td className="py-3 px-4 text-center">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      {workload.filteredIsFeasible ?
                                        <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                                      : <AlertTriangle className="w-5 h-5 text-red-500 mx-auto" />
                                      }
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {workload.filteredIsFeasible ?
                                          "On track to complete by deadline"
                                        : "May not complete by deadline"}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </td>
                              <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                                {workload.filteredEarliestDeadline ?
                                  format(
                                    workload.filteredEarliestDeadline,
                                    "MMM d, yyyy"
                                  )
                                : "-"}
                              </td>
                            </tr>
                            {/* Expanded project details */}
                            {isExpanded && (
                              <tr>
                                <td colSpan={9} className="p-0">
                                  <div className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                                    <div className="px-8 py-4">
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                        Assigned Projects (
                                        {workload.projects.length})
                                      </h4>
                                      <table className="w-full">
                                        <thead>
                                          <tr className="text-xs text-gray-500 dark:text-gray-400">
                                            <th className="text-left py-2 px-3 font-medium">
                                              Project
                                            </th>
                                            <th className="text-left py-2 px-3 font-medium">
                                              System
                                            </th>
                                            <th className="text-right py-2 px-3 font-medium">
                                              Words (Share)
                                            </th>
                                            <th className="text-right py-2 px-3 font-medium">
                                              Lines (Share)
                                            </th>
                                            <th className="text-left py-2 px-3 font-medium">
                                              Translators
                                            </th>
                                            <th className="text-left py-2 px-3 font-medium">
                                              Deadline
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {workload.projects.map((project) => {
                                            const isWithinDate =
                                              !userTargetDate ||
                                              !project.deadline ||
                                              isBefore(
                                                project.deadline,
                                                userTargetDate
                                              ) ||
                                              project.deadline.getTime() ===
                                                userTargetDate.getTime();
                                            return (
                                              <tr
                                                key={project.id}
                                                className={`text-xs border-t border-gray-200 dark:border-gray-700/50 ${
                                                  !isWithinDate ? "opacity-40"
                                                  : ""
                                                }`}
                                              >
                                                <td className="py-2 px-3 text-gray-900 dark:text-white">
                                                  {project.name}
                                                  {!isWithinDate && (
                                                    <span className="ml-2 text-gray-400 italic">
                                                      (outside date range)
                                                    </span>
                                                  )}
                                                </td>
                                                <td className="py-2 px-3 text-gray-600 dark:text-gray-400">
                                                  {project.system}
                                                </td>
                                                <td className="py-2 px-3 text-gray-900 dark:text-white text-right">
                                                  {project.wordsShare.toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3 text-gray-900 dark:text-white text-right">
                                                  {project.linesShare.toLocaleString()}
                                                </td>
                                                <td className="py-2 px-3">
                                                  <div className="flex flex-wrap gap-2">
                                                    {project.translators.map(
                                                      (translator) => (
                                                        <div
                                                          key={translator.id}
                                                          className="flex items-center gap-1 text-gray-700 dark:text-gray-300"
                                                        >
                                                          <ProfileAvatar
                                                            name={
                                                              translator.name
                                                            }
                                                            avatar={
                                                              translator.avatar
                                                            }
                                                            size="xs"
                                                            showEditButton={
                                                              false
                                                            }
                                                          />
                                                          <span className="text-xs">
                                                            {translator.shortName ||
                                                              translator.name}
                                                          </span>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2 px-3">
                                                  <DeadlineDisplay
                                                    initialDeadline={
                                                      project.initialDeadline
                                                    }
                                                    interimDeadline={
                                                      project.interimDeadline
                                                    }
                                                    finalDeadline={
                                                      project.finalDeadline
                                                    }
                                                  />
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          : <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="flex items-center justify-center min-h-[200px]">
                <div className="text-center">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    No users with assigned projects found
                  </p>
                </div>
              </CardContent>
            </Card>
          }
        </>
      )}
    </div>
  );
}
