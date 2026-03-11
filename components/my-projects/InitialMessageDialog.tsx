"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface InitialMessageDialogProps {
  open: boolean;
  projectName: string;
  message: string;
  onClose: () => void;
  onClaim: () => void;
}

export function InitialMessageDialog({
  open,
  projectName,
  message,
  onClose,
  onClaim,
}: InitialMessageDialogProps) {
  const handleClose = () => {
    onClose();
    // After closing, proceed with claim
    onClaim();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between pr-8">
            <span>Custom Instruction - {projectName}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <div className="px-6 py-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg min-h-[200px]">
            <p className="text-gray-900 dark:text-white whitespace-pre-wrap text-base leading-relaxed">
              {message}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-blue-500 hover:bg-blue-600 dark:hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
            type="button"
          >
            Got it, Claim Project
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
