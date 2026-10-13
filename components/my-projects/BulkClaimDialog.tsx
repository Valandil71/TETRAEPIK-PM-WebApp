"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BulkClaimDialogProps {
  open: boolean;
  projectCount: number;
  /** Projects that came with a custom instruction from the PM. */
  instructions: { projectId: number; projectName: string; message: string }[];
  onClaim: () => void;
  onCancel: () => void;
}

/** Before a bulk claim, shows every custom instruction the PM left on the selected projects. */
export function BulkClaimDialog({
  open,
  projectCount,
  instructions,
  onClaim,
  onCancel,
}: BulkClaimDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Custom Instructions</DialogTitle>
          <DialogDescription>
            {instructions.length === 1 ?
              "One of the selected projects has"
            : `${instructions.length} of the selected projects have`}{" "}
            a custom instruction from the PM.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 py-2">
          {instructions.map(({ projectId, projectName, message }) => (
            <div
              key={projectId}
              className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
                {projectName}
              </p>
              <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap text-sm leading-relaxed">
                {message}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={onClaim} className="bg-blue-500 hover:bg-blue-600 text-white">
            Got it, Claim {projectCount} Project{projectCount !== 1 ? "s" : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
