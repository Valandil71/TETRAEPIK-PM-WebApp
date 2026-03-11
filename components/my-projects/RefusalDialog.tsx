"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RefusalDialogProps {
  open: boolean;
  projectName: string;
  onConfirm: (message: string) => void;
  onCancel: () => void;
}

export function RefusalDialog({
  open,
  projectName,
  onConfirm,
  onCancel,
}: RefusalDialogProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleConfirm = () => {
    if (message.trim().length <= 10) {
      setError("Please provide a reason with more than 10 characters");
      return;
    }
    onConfirm(message.trim());
    setMessage("");
    setError("");
  };

  const handleCancel = () => {
    setMessage("");
    setError("");
    onCancel();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Only trigger if validation passes (same as button)
      if (message.trim().length > 10) {
        handleConfirm();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Refuse Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Please provide a reason for refusing &quot;{projectName}&quot; (minimum 10
              characters):
            </p>
            <textarea
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="Enter your refusal reason..."
              className="w-full px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none min-h-[120px]"
              rows={4}
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {error}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {message.length} characters
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={message.trim().length <= 10}
            className="bg-red-500 hover:bg-red-600 text-white"
          >
            Refuse Project
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
