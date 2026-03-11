"use client";

interface ProfileStatusProps {
  hasChanges: boolean;
  lastSavedAt: Date | null;
  isEditing?: boolean;
}

export function ProfileStatus({ hasChanges, lastSavedAt, isEditing = false }: ProfileStatusProps) {
  return (
    <div className="flex flex-col items-start md:items-end gap-1 text-xs text-gray-500 dark:text-gray-400">
      {isEditing ? (
        hasChanges ? (
          <span className="text-amber-600 dark:text-amber-400">
            • Unsaved changes
          </span>
        ) : (
          <span className="text-blue-600 dark:text-blue-400">
            • Editing
          </span>
        )
      ) : (
        <span>All changes saved</span>
      )}
      {lastSavedAt && !isEditing && (
        <span>
          Last updated:{" "}
          {lastSavedAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      )}
    </div>
  );
}

