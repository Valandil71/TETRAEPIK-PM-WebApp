import { LayoutGrid, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  className?: string;
}

/**
 * Reusable empty state component for tables and lists
 */
export function EmptyState({
  icon: Icon = LayoutGrid,
  title,
  subtitle,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
        <Icon className="w-8 h-8 text-gray-400 dark:text-gray-500" />
      </div>
      <p className="text-gray-500 dark:text-gray-400">{title}</p>
      {subtitle && (
        <p className="text-gray-400 dark:text-gray-500 text-sm">{subtitle}</p>
      )}
    </div>
  );
}
