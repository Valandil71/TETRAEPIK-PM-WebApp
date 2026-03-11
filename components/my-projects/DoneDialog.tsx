"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface DoneDialogProps {
  open: boolean;
  projectName: string;
  onConfirm: (message: string | null) => void;
  onCancel: () => void;
}

export function DoneDialog({
  open,
  projectName,
  onConfirm,
  onCancel,
}: DoneDialogProps) {
  const [wantsToNote, setWantsToNote] = useState(false);
  const [message, setMessage] = useState("");

  const handleConfirm = () => {
    onConfirm(wantsToNote ? message.trim() || null : null);
    setWantsToNote(false);
    setMessage("");
  };

  const handleCancel = () => {
    setWantsToNote(false);
    setMessage("");
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Mark Project as Done</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            You are about to mark{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              &quot;{projectName}&quot;
            </span>{" "}
            as done.
          </p>

          <div className="flex items-center gap-3">
            <Checkbox
              id="wants-note"
              checked={wantsToNote}
              onCheckedChange={(checked) => {
                setWantsToNote(!!checked);
                if (!checked) setMessage("");
              }}
            />
            <Label
              htmlFor="wants-note"
              className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none"
            >
              Leave a note for the PM{" "}
              <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </Label>
          </div>

          {wantsToNote && (
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write your note here..."
              autoFocus
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none min-h-[100px]"
              rows={4}
            />
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            Mark as Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
