"use client";

import { MoreVertical, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MyProjectsActionsMenuProps {
  activeTab: "unclaimed" | "inProgress";
  onSelectMultiple: () => void;
}

/** Shown next to Claim/Done only when the tab has more than one project. */
export function MyProjectsActionsMenu({ activeTab, onSelectMultiple }: MyProjectsActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          aria-label="More actions"
        >
          <MoreVertical className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenuItem
          className="cursor-pointer px-4 py-2.5 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-gray-700 focus:bg-blue-100 dark:focus:bg-gray-700"
          onClick={(e) => {
            e.stopPropagation();
            onSelectMultiple();
          }}
        >
          <ListChecks className="w-4 h-4 mr-2" />
          {activeTab === "unclaimed" ? "Claim multiple" : "Mark multiple as done"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
