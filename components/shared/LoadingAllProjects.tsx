import { Loader2 } from "lucide-react";

/**
 * Shown in place of the pagination while a list shows only its first rows and the full list
 * is still loading (Concluded Projects, Invoicing).
 */
export function LoadingAllProjects() {
  return (
    <div
      role="status"
      className="mb-6 flex items-center justify-center gap-2 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-6 py-4 text-sm text-gray-500 dark:text-gray-400"
    >
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading all projects… Search and filters will be available in a moment.
    </div>
  );
}
