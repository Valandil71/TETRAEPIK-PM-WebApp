"use client";

import { FileText, Calendar, FileDown, FileUp, Receipt, Link, Tag, Layers, List, Hash, FolderOpen, Timer } from "lucide-react";
import { formatNumber } from "@/utils/formatters";
import { format } from "date-fns";
import type { ProjectWithTranslatorDetails } from "@/types/project";

interface ProjectDetailsCardProps {
  project: ProjectWithTranslatorDetails;
  showFinancial?: boolean;
}

function DetailItem({
  icon: Icon,
  iconBg,
  iconColor,
  label,
  children,
}: {
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 ${iconBg} rounded-lg flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-1">{label}</p>
        <div className="text-gray-900 dark:text-white font-medium">{children}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
      {title}
    </h3>
  );
}

function SectionDivider() {
  return <div className="border-t border-gray-100 dark:border-gray-700/50" />;
}

export function ProjectDetailsCard({
  project,
  showFinancial = true,
}: ProjectDetailsCardProps) {
  // Section visibility checks
  const hasDeadlines = !!(project.initial_deadline || project.interim_deadline || project.final_deadline);
  const hasMetrics = !!(project.words != null || project.lines != null || (project.hours != null && project.hours > 0));
  const hasLanguages = !!(project.language_in || project.language_out);
  const hasSapMetadata = !!(
    project.sap_pm ||
    project.url ||
    (project.terminology_key && project.terminology_key.length > 0) ||
    (project.translation_area && project.translation_area.length > 0) ||
    (project.work_list && project.work_list.length > 0) ||
    (project.graph_id && project.graph_id.length > 0) ||
    (project.lxe_project && project.lxe_project.length > 0) ||
    (project.lxe_projects && project.lxe_projects.length > 0 &&
      !(project.lxe_project && project.lxe_project.length > 0 &&
        JSON.stringify(project.lxe_project) === JSON.stringify(project.lxe_projects)))
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <h2 className="text-gray-900 dark:text-white mb-6 text-xl font-semibold">
        Project Details
      </h2>

      <div className="space-y-6">
        {/* Overview - always visible (status always exists) */}
        <div>
          <SectionHeader title="Overview" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <DetailItem icon={FileText} iconBg="bg-gray-100 dark:bg-gray-700" iconColor="text-gray-600 dark:text-gray-400" label="Status">
              <span className="capitalize">{project.status}</span>
            </DetailItem>

            {project.project_type && (
              <DetailItem icon={Tag} iconBg="bg-cyan-100 dark:bg-cyan-900/30" iconColor="text-cyan-600 dark:text-cyan-400" label="Project Type">
                {project.project_type}
              </DetailItem>
            )}
          </div>
        </div>

        {/* Languages */}
        {hasLanguages && (
          <>
            <SectionDivider />
            <div>
              <SectionHeader title="Languages" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.language_in && (
                  <DetailItem icon={FileDown} iconBg="bg-pink-100 dark:bg-pink-900/30" iconColor="text-pink-600 dark:text-pink-400" label="Source Language">
                    {project.language_in}
                  </DetailItem>
                )}

                {project.language_out && (
                  <DetailItem icon={FileUp} iconBg="bg-teal-100 dark:bg-teal-900/30" iconColor="text-teal-600 dark:text-teal-400" label="Target Language">
                    {project.language_out}
                  </DetailItem>
                )}
              </div>
            </div>
          </>
        )}

        {/* Deadlines */}
        {hasDeadlines && (
          <>
            <SectionDivider />
            <div>
              <SectionHeader title="Deadlines" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {project.initial_deadline && (
                  <DetailItem icon={Calendar} iconBg="bg-orange-100 dark:bg-orange-900/30" iconColor="text-orange-600 dark:text-orange-400" label="Initial Deadline">
                    {format(new Date(project.initial_deadline), "dd MMM yyyy 'at' HH:mm")}
                  </DetailItem>
                )}

                {project.interim_deadline && (
                  <DetailItem icon={Calendar} iconBg="bg-yellow-100 dark:bg-yellow-900/30" iconColor="text-yellow-600 dark:text-yellow-400" label="Interim Deadline">
                    {format(new Date(project.interim_deadline), "dd MMM yyyy 'at' HH:mm")}
                  </DetailItem>
                )}

                {project.final_deadline && (
                  <DetailItem icon={Calendar} iconBg="bg-red-100 dark:bg-red-900/30" iconColor="text-red-600 dark:text-red-400" label="Final Deadline">
                    {format(new Date(project.final_deadline), "dd MMM yyyy 'at' HH:mm")}
                  </DetailItem>
                )}
              </div>
            </div>
          </>
        )}

        {/* Metrics */}
        {hasMetrics && (
          <>
            <SectionDivider />
            <div>
              <SectionHeader title="Metrics" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {project.words != null && (
                  <DetailItem icon={FileText} iconBg="bg-purple-100 dark:bg-purple-900/30" iconColor="text-purple-600 dark:text-purple-400" label="Word Count">
                    {formatNumber(project.words)} words
                  </DetailItem>
                )}

                {project.lines != null && (
                  <DetailItem icon={FileText} iconBg="bg-indigo-100 dark:bg-indigo-900/30" iconColor="text-indigo-600 dark:text-indigo-400" label="Lines">
                    {formatNumber(project.lines)}
                  </DetailItem>
                )}

                {project.hours != null && project.hours > 0 && (
                  <DetailItem icon={Timer} iconBg="bg-lime-100 dark:bg-lime-900/30" iconColor="text-lime-600 dark:text-lime-400" label="Hours">
                    {project.hours}
                  </DetailItem>
                )}
              </div>
            </div>
          </>
        )}

        {/* SAP Metadata */}
        {hasSapMetadata && (
          <>
            <SectionDivider />
            <div>
              <SectionHeader title="SAP Metadata" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {project.url && (
                  <DetailItem icon={Link} iconBg="bg-sky-100 dark:bg-sky-900/30" iconColor="text-sky-600 dark:text-sky-400" label="URL">
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {project.url}
                    </a>
                  </DetailItem>
                )}

                {project.terminology_key && project.terminology_key.length > 0 && (
                  <DetailItem icon={Hash} iconBg="bg-rose-100 dark:bg-rose-900/30" iconColor="text-rose-600 dark:text-rose-400" label="Terminology Key">
                    {project.terminology_key.join(", ")}
                  </DetailItem>
                )}

                {project.translation_area && project.translation_area.length > 0 && (
                  <DetailItem icon={Layers} iconBg="bg-violet-100 dark:bg-violet-900/30" iconColor="text-violet-600 dark:text-violet-400" label="Translation Area">
                    {project.translation_area.join(", ")}
                  </DetailItem>
                )}

                {project.work_list && project.work_list.length > 0 && (
                  <DetailItem icon={List} iconBg="bg-fuchsia-100 dark:bg-fuchsia-900/30" iconColor="text-fuchsia-600 dark:text-fuchsia-400" label="Work List">
                    {project.work_list.join(", ")}
                  </DetailItem>
                )}

                {project.graph_id && project.graph_id.length > 0 && (
                  <DetailItem icon={Hash} iconBg="bg-emerald-100 dark:bg-emerald-900/30" iconColor="text-emerald-600 dark:text-emerald-400" label="Graph ID">
                    {project.graph_id.join(", ")}
                  </DetailItem>
                )}

                {project.lxe_project && project.lxe_project.length > 0 && (
                  <DetailItem icon={FolderOpen} iconBg="bg-stone-100 dark:bg-stone-900/30" iconColor="text-stone-600 dark:text-stone-400" label="LXE Project">
                    {project.lxe_project.join(", ")}
                  </DetailItem>
                )}

                {project.lxe_projects && project.lxe_projects.length > 0 &&
                  !(project.lxe_project && project.lxe_project.length > 0 &&
                    JSON.stringify(project.lxe_project) === JSON.stringify(project.lxe_projects)) && (
                  <DetailItem icon={FolderOpen} iconBg="bg-stone-100 dark:bg-stone-900/30" iconColor="text-stone-600 dark:text-stone-400" label="LXE Projects">
                    {project.lxe_projects.join(", ")}
                  </DetailItem>
                )}

                {project.sap_pm && (
                  <DetailItem icon={FileText} iconBg="bg-amber-100 dark:bg-amber-900/30" iconColor="text-amber-600 dark:text-amber-400" label="SAP PM">
                    {project.sap_pm}
                  </DetailItem>
                )}
              </div>
            </div>
          </>
        )}

        {/* Financial */}
        {showFinancial && (
          <>
            <SectionDivider />
            <div>
              <SectionHeader title="Financial" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DetailItem icon={Receipt} iconBg="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" label="Paid">
                  {project.paid ? "Yes" : "No"}
                </DetailItem>

                <DetailItem icon={Receipt} iconBg="bg-blue-100 dark:bg-blue-900/30" iconColor="text-blue-600 dark:text-blue-400" label="Invoiced">
                  {project.invoiced ? "Yes" : "No"}
                </DetailItem>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
