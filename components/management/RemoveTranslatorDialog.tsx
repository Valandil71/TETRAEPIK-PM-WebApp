"use client";

import { useState } from "react";
import { UserCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "./ConfirmationDialog";

interface Translator {
  id: string;
  name: string;
  role: string;
  assignment_status: string;
}

interface RemoveTranslatorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  projectName: string;
  translators: Translator[];
  onRemoveTranslator: (projectId: number, userId: string) => void;
  isRemoving: boolean;
}

export function RemoveTranslatorDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  translators,
  onRemoveTranslator,
  isRemoving,
}: RemoveTranslatorDialogProps) {
  const [selectedTranslator, setSelectedTranslator] = useState<Translator | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleTranslatorClick = (translator: Translator) => {
    setSelectedTranslator(translator);
    setShowConfirmation(true);
  };

  const handleConfirmRemove = () => {
    if (selectedTranslator) {
      onRemoveTranslator(projectId, selectedTranslator.id);
      setSelectedTranslator(null);
      setShowConfirmation(false);
      onOpenChange(false);
    }
  };

  const handleCancelConfirmation = () => {
    setSelectedTranslator(null);
    setShowConfirmation(false);
  };

  const handleClose = () => {
    setSelectedTranslator(null);
    setShowConfirmation(false);
    onOpenChange(false);
  };

  // Show confirmation dialog if translator is selected
  if (showConfirmation && selectedTranslator) {
    return (
      <ConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        title="Confirm Removal"
        description={`Are you sure you want to remove ${selectedTranslator.name} from ${projectName}?`}
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={handleConfirmRemove}
        onCancel={handleCancelConfirmation}
        isLoading={isRemoving}
        variant="destructive"
      />
    );
  }

  // Main translator selection dialog
  return (
    <Dialog open={open && !showConfirmation} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Collaborator</DialogTitle>
          <DialogDescription>
            Select a collaborator to remove from{" "}
            <span className="font-medium">{projectName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {translators.length > 0 ?
            translators.map((translator) => (
              <button
                key={translator.id}
                onClick={() => handleTranslatorClick(translator)}
                disabled={isRemoving}
                className="w-full cursor-pointer flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-900/20 border border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-700 rounded-lg transition-colors text-left group disabled:opacity-50 disabled:cursor-not-allowed"
                type="button"
              >
                <UserCircle className="w-5 h-5 text-gray-400 dark:text-gray-500 group-hover:text-red-500" />
                <span className="text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400">
                  {translator.name}
                </span>
              </button>
            ))
          : <p className="text-gray-500 dark:text-gray-400 text-sm italic text-center py-4">
              No collaborators assigned to this project.
            </p>
          }
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isRemoving}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
