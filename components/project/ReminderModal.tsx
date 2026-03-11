"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReminderModalProps {
  open: boolean;
  translatorName: string;
  initialValue?: string | null;
  onClose: () => void;
  onSend: (message: string | null) => void;
  isSending: boolean;
}

export function ReminderModal({
  open,
  translatorName,
  initialValue,
  onClose,
  onSend,
  isSending,
}: ReminderModalProps) {
  const [message, setMessage] = useState(initialValue ?? "");

  useEffect(() => {
    if (open) {
      const timeout = setTimeout(() => {
        setMessage(initialValue ?? "");
      }, 0);
      return () => clearTimeout(timeout);
    }
  }, [open, initialValue]);

  const handleSend = () => {
    onSend(message.trim() || null);
  };

  const handleClose = () => {
    setMessage("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) {
        handleSend();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>PM Note for {translatorName}</DialogTitle>
          <DialogDescription>
            This note will be shown to the translator when they view the project.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a note for the collaborator... (leave empty to clear)"
            className="min-h-32"
            disabled={isSending}
          />

          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
