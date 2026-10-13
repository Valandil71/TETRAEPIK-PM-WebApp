import { formatProjectName } from "@/utils/formatters";
import { LanguagePair } from "@/components/shared/LanguagePair";

interface ProjectNameListProps {
  projects: {
    id: number;
    name: string;
    system: string;
    language_in: string | null;
    language_out: string | null;
  }[];
}

/** Project names on their own lines (system and languages underneath), for confirmation popups. */
export function ProjectNameList({ projects }: ProjectNameListProps) {
  return (
    <ul className="max-h-48 overflow-y-auto space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 px-3 py-2">
      {projects.map((project) => (
        <li key={project.id} className="break-words">
          <span className="block font-medium text-gray-900 dark:text-white">
            {formatProjectName(project.name)}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            {project.system} ·{" "}
            <LanguagePair
              languageIn={project.language_in}
              languageOut={project.language_out}
              className="text-gray-500 dark:text-gray-400"
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
