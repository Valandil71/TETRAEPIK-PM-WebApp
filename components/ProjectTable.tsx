"use client";

import { useRouter } from "next/navigation";
import { format, differenceInHours } from "date-fns";
import { pt } from "date-fns/locale";
import { Loader2 } from "lucide-react";
import { useProjectsWithTranslators } from "@/hooks/project/useProjectsWithTranslators";
import { useColorSettings } from "@/hooks/settings/useColorSettings";
import type { ProjectWithTranslators } from "@/types/project";
import { formatRoleDisplay } from "@/utils/formatters";

interface ProjectTableProps {
  showPast?: boolean;
}

export function ProjectTable({ showPast = false }: ProjectTableProps) {
  const router = useRouter();
  const { getRowColors, loading: colorLoading } = useColorSettings();
  const {
    data: projects = [],
    isLoading: projectsLoading,
    error,
  } = useProjectsWithTranslators(showPast);

  function formatDeadline(date: string | null) {
    if (!date) return null;
    try {
      return format(new Date(date), "dd/MM HH'h'", { locale: pt });
    } catch {
      return null;
    }
  }

  function getDeadlineBadge(deadline: string | null) {
    if (!deadline) return null;
    const diffHours = differenceInHours(new Date(deadline), new Date());
    if (diffHours < 0) return null;
    if (diffHours <= 24)
      return (
        <span className="ml-2 text-xs font-semibold text-red-600">
          ⚠️ &lt;24h
        </span>
      );
    if (diffHours <= 72)
      return (
        <span className="ml-2 text-xs font-semibold text-orange-500">
          🕒 &lt;3d
        </span>
      );
    return (
      <span className="ml-2 text-xs font-semibold text-green-600">🟢 ok</span>
    );
  }

  if (colorLoading || projectsLoading)
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="animate-spin w-6 h-6 text-muted-foreground" />
      </div>
    );

  if (error)
    return (
      <div className="flex justify-center items-center py-12">
        <p className="text-red-500">
          Error loading projects. Please try again.
        </p>
      </div>
    );

  const handleRowClick = (project: ProjectWithTranslators) => {
    router.push(`/project/${project.id}`);
  };

  type Column = {
    header: string;
    className?: string;
    render: (item: ProjectWithTranslators, index: number) => React.ReactNode;
  };

  const columns: Column[] = [
    {
      header: "Name",
      render: (project: ProjectWithTranslators) => {
        const { textClass, textColorPreview } = getRowColors({
          status: project.status,
          system: project.system,
          langIn: project.language_in,
          langOut: project.language_out,
        });
        const textStyle = textClass ? {} : { color: textColorPreview };
        return (
          <span
            className={`font-medium ${textClass}`}
            style={textStyle}
            onClick={() => router.push(`/project/${project.id}`)}
          >
            {project.name}
          </span>
        );
      },
    },
    {
      header: "System",
      render: (project: ProjectWithTranslators) => (
        <span onClick={() => router.push(`/project/${project.id}`)}>
          {project.system || "-"}
        </span>
      ),
    },
    {
      header: "Words",
      render: (project: ProjectWithTranslators) => (
        <span onClick={() => router.push(`/project/${project.id}`)}>
          {project.words ?? "-"}
        </span>
      ),
    },
    {
      header: "Lines",
      render: (project: ProjectWithTranslators) => (
        <span onClick={() => router.push(`/project/${project.id}`)}>
          {project.lines ?? "-"}
        </span>
      ),
    },
    {
      header: "Deadlines",
      className: "whitespace-pre-line",
      render: (project: ProjectWithTranslators) => {
        const nearest =
          project.interim_deadline || project.final_deadline || null;
        return (
          <div onClick={() => router.push(`/project/${project.id}`)}>
            {[
              project.initial_deadline &&
                `initial — ${formatDeadline(project.initial_deadline)}`,
              project.interim_deadline &&
                `interim — ${formatDeadline(project.interim_deadline)}`,
              project.final_deadline &&
                `final — ${formatDeadline(project.final_deadline)}`,
            ]
              .filter(Boolean)
              .join("\n") || "-"}
            {nearest && getDeadlineBadge(nearest)}
          </div>
        );
      },
    },
    {
      header: "Collaborators",
      render: (project: ProjectWithTranslators) =>
        project.translators && project.translators.length > 0 ?
          <div
            className="space-y-1"
            onClick={() => router.push(`/project/${project.id}`)}
          >
            {project.translators.map((translator) => (
              <div key={translator.id} className="text-xs">
                <span className="font-medium">{translator.name}</span>
                <span className="text-gray-800 ml-1">
                  ({formatRoleDisplay(translator.role)})
                </span>
                {translator.assignment_status === "claimed" && (
                  <span className="ml-1 text-green-800 font-bold">
                    ✓
                  </span>
                )}
                {translator.assignment_status === "done" && (
                  <span className="ml-1 text-blue-800 font-bold">
                    ✓✓
                  </span>
                )}
              </div>
            ))}
          </div>
        : "-",
    },
    {
      header: "Instructions",
      className: "break-words max-w-[600px]",
      render: (project: ProjectWithTranslators) => (
        project.instructions || "-"
      ),
    },
  ];

  return (
    <div className="relative border rounded-lg shadow-sm flex-1 overflow-y-auto max-h-[calc(100vh-18rem)]">
      <div className="bg-white dark:bg-gray-800">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-muted text-muted-foreground uppercase text-xs sticky top-0 z-10">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={index}
                  className={`px-5 py-3 whitespace-nowrap ${column.className || ""}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {projects.length > 0 ?
              projects.map((project, rowIndex) => {
                const { bgClass, bgColorPreview } = getRowColors({
                  status: project.status,
                  system: project.system,
                  langIn: project.language_in,
                  langOut: project.language_out,
                });
                const rowBgStyle = bgClass ? {} : { backgroundColor: bgColorPreview };
                return (
                  <tr
                    key={project.id}
                    className={`border-t hover:opacity-80 transition-all cursor-pointer ${bgClass}`}
                    style={rowBgStyle}
                    onClick={() => handleRowClick(project)}
                  >
                    {columns.map((column, colIndex) => (
                      <td
                        key={colIndex}
                        className={`px-5 py-3 ${column.className || ""}`}
                      >
                        {column.render(project, rowIndex)}
                      </td>
                    ))}
                  </tr>
                );
              })
            : <tr>
                <td colSpan={columns.length} className="px-5 py-12 text-center">
                  <div className="flex justify-center items-center py-12">
                    <p className="text-gray-500">No projects found</p>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
