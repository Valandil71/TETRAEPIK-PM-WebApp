"use client";

import { ClipboardCheck, ListChecks, UserPlus, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ProjectNameList } from "./ProjectNameList";

interface MarkReviewedDialogProps {
  open: boolean;
  projects: React.ComponentProps<typeof ProjectNameList>["projects"];
  /** Closing (X, Esc, outside click) changes nothing. */
  onClose: () => void;
  onSelectMore: () => void;
  /** Opens "Add translator"; the projects are only marked reviewed once that is confirmed. */
  onAddTranslator: () => void;
  onMarkReviewed: () => void;
  isLoading?: boolean;
}

/** Confirms that projects imported without lines/words were checked (SOL, volume) by a PM. */
export function MarkReviewedDialog({
  open,
  projects,
  onClose,
  onSelectMore,
  onAddTranslator,
  onMarkReviewed,
  isLoading = false,
}: MarkReviewedDialogProps) {
  const isBulk = projects.length > 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isLoading && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ClipboardCheck className="w-6 h-6 text-amber-500" />
            <DialogTitle>
              {isBulk ? `Mark ${projects.length} projects as reviewed` : "Mark project as reviewed"}
            </DialogTitle>
          </div>
          <DialogDescription asChild className="pt-2">
            <div className="space-y-3">
              <p>
                {isBulk ? "These projects" : "This project"} came from SAP without lines or words.
                Once reviewed {isBulk ? "they move" : "it moves"} out of To Review and can be
                assigned.
              </p>
              <ProjectNameList projects={projects} />
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2 sm:space-x-0 sm:flex-wrap">
          <Button variant="outline" onClick={onSelectMore} disabled={isLoading}>
            <ListChecks className="w-4 h-4 mr-1.5" />
            Select more
          </Button>
          <Button
            onClick={onAddTranslator}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Add translator
          </Button>
          <Button
            onClick={onMarkReviewed}
            disabled={isLoading}
            autoFocus
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            <CheckCircle className="w-4 h-4 mr-1.5" />
            {isLoading ? "Processing..." : "Mark as reviewed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
