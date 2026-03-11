"use client";

import {
  MoreVertical,
  CheckCircle,
  UserPlus,
  UserMinus,
  Copy,
  Edit,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface ProjectActionsMenuProps {
  projectId: number;
  isOpen: boolean;
  translators: Array<{
    id: string;
    name: string;
    role: string;
    assignment_status: string;
  }>;
  onToggle: () => void;
  onAddTranslator: () => void;
  onRemoveTranslator: () => void;
  onDuplicate: () => void;
  onEditDetails: () => void;
  onCompleteProject: () => void;
}

export function ProjectActionsMenu({
  projectId,
  isOpen,
  translators,
  onToggle,
  onAddTranslator,
  onRemoveTranslator,
  onDuplicate,
  onEditDetails,
  onCompleteProject,
}: ProjectActionsMenuProps) {
  // Check if project is ready to be completed (all translators have assignment_status === "done")
  const isReadyToComplete =
    translators.length > 0 &&
    translators.every((t) => t.assignment_status === "done");

  const handleOpenChange = (open: boolean) => {
    // Only call onToggle when closing (to sync parent state)
    // or when opening from closed state
    if (open !== isOpen) {
      onToggle();
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer hover:shadow-lg"
          onClick={(e) => e.stopPropagation()}
          aria-label="Project actions"
        >
          <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        data-project-id={projectId}
        className="w-52 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {isReadyToComplete && (
          <>
            <DropdownMenuItem
              className="cursor-pointer px-4 py-2.5 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 focus:bg-green-50 dark:focus:bg-green-900/20 focus:text-green-700 dark:focus:text-green-400"
              onClick={(e) => {
                e.stopPropagation();
                onCompleteProject();
              }}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Project
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
          </>
        )}
        <DropdownMenuItem
          className="cursor-pointer px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 focus:bg-blue-100 dark:focus:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            onAddTranslator();
          }}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Add translator
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-gray-700 hover:text-red-700 dark:hover:text-red-400 focus:bg-red-100 dark:focus:bg-gray-700 focus:text-red-700 dark:focus:text-red-400"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveTranslator();
          }}
        >
          <UserMinus className="w-4 h-4 mr-2" />
          Remove a translator
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 focus:bg-blue-100 dark:focus:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
        >
          <Copy className="w-4 h-4 mr-2" />
          Duplicate Project
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 focus:bg-blue-100 dark:focus:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            onEditDetails();
          }}
        >
          <Edit className="w-4 h-4 mr-2" />
          Edit Details
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
