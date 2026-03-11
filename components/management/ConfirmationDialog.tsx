"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  variant?: "default" | "destructive" | "success";
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  variant = "default",
}: ConfirmationDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      if (!isLoading) {
        onCancel();
      }
      onOpenChange(false);
      return;
    }
    onOpenChange(true);
  };

  const handleConfirm = () => {
    if (isLoading) return;
    onConfirm();
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (isLoading) return;
    onCancel();
    onOpenChange(false);
  };

  const isStringDescription = typeof description === "string";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleConfirm();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          {isStringDescription ? (
            <DialogDescription className="pt-2">{description}</DialogDescription>
          ) : (
            <DialogDescription asChild className="pt-2">
              <div>{description}</div>
            </DialogDescription>
          )}
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isLoading}
            autoFocus
            variant={variant === "destructive" ? "destructive" : "default"}
            className={
              variant === "success"
                ? "bg-green-500 hover:bg-green-600 text-white"
                : undefined
            }
          >
            {isLoading ? "Processing..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
