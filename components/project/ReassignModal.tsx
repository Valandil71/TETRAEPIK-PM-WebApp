"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReassignModalProps {
  open: boolean;
  translatorName: string;
  onClose: () => void;
  onReassign: (message: string | null) => void;
  isReassigning: boolean;
}

export function ReassignModal({
  open,
  translatorName,
  onClose,
  onReassign,
  isReassigning,
}: ReassignModalProps) {
  const [message, setMessage] = useState("");

  const handleReassign = () => {
    onReassign(message.trim() || null);
    setMessage("");
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isReassigning) {
        handleReassign();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign {translatorName}</DialogTitle>
          <DialogDescription>
            This will reset the assignment to{" "}
            <span className="font-medium text-gray-900 dark:text-white">
              Available to Claim
            </span>
            , clearing any previous messages. You can optionally add a new note
            for the translator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Optional note for the collaborator..."
            className="min-h-28"
            disabled={isReassigning}
          />

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isReassigning}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReassign}
              disabled={isReassigning}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isReassigning ? "Reassigning..." : "Reassign"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
