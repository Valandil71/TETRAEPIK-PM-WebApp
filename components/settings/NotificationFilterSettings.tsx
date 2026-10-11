"use client";

import { Bell } from "lucide-react";
import { useNotificationPreferences } from "@/hooks/notifications/useNotificationPreferences";
import { ProjectTypePicker } from "@/components/settings/ProjectTypePicker";

interface NotificationFilterSettingsProps {
  userId: string | null;
  availableProjectTypes: string[];
}

export function NotificationFilterSettings({
  userId,
  availableProjectTypes,
}: NotificationFilterSettingsProps) {
  const { projectTypes, saveProjectTypes, isFetched, isLoading, isUpdating } =
    useNotificationPreferences(userId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-left">
      <div className="mb-5">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Bell className="w-6 h-6" />
          Notification Project Type Filter
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choose which project types send you desktop notifications when projects are
          completed or assigned to you.
        </p>
      </div>

      <ProjectTypePicker
        availableProjectTypes={availableProjectTypes}
        savedTypes={projectTypes}
        isFetched={isFetched}
        isLoading={isLoading}
        isUpdating={isUpdating}
        onSave={saveProjectTypes}
        emptySelectionText="No filter — you'll be notified for all project types."
      />
    </div>
  );
}
