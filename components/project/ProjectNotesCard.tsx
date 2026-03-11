"use client";

import { useState } from "react";
import { StickyNote, Save, X, Edit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSupabase } from "@/hooks/core/useSupabase";
import { queryKeys } from "@/lib/queryKeys";
import { toast } from "sonner";

interface ProjectNotesCardProps {
  projectId: number;
  notes: string | null | undefined;
  canEdit: boolean;
}

export function ProjectNotesCard({
  projectId,
  notes,
  canEdit,
}: ProjectNotesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notes || "");
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: async (newNotes: string) => {
      const { error } = await supabase
        .from("projects")
        .update({ project_notes: newNotes || null })
        .eq("id", projectId);

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.project(projectId) });
      toast.success("Notes saved");
      setIsEditing(false);
    },
    onError: () => {
      toast.error("Failed to save notes");
    },
  });

  const handleSave = () => {
    updateMutation.mutate(editValue);
  };

  const handleCancel = () => {
    setEditValue(notes || "");
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
            <StickyNote className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-gray-900 dark:text-white text-xl font-semibold">
            Notes
          </h2>
        </div>
        {canEdit && !isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditValue(notes || "");
              setIsEditing(true);
            }}
          >
            <Edit className="w-4 h-4" />
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
            placeholder="Add project notes..."
          />
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={updateMutation.isPending}
            >
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Save className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line text-sm">
          {notes || (
            <span className="text-gray-400 dark:text-gray-500 italic">
              No notes yet
            </span>
          )}
        </p>
      )}
    </div>
  );
}
