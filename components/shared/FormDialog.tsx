"use client";

import { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  submitVariant?: "default" | "destructive";
  isLoading?: boolean;
  isSubmitDisabled?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "5xl";
}

/**
 * Reusable form dialog wrapper component
 * Provides consistent structure for form-based dialogs using shadcn Dialog
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  onCancel,
  submitLabel = "Submit",
  cancelLabel = "Cancel",
  submitVariant = "default",
  isLoading = false,
  isSubmitDisabled = false,
  maxWidth = "md",
}: FormDialogProps) {
  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  const maxWidthClasses = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
    xl: "sm:max-w-xl",
    "2xl": "sm:max-w-2xl",
    "5xl": "sm:max-w-5xl",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={maxWidthClasses[maxWidth]}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-4 py-4">{children}</div>

        {(onSubmit || onCancel) && (
          <DialogFooter>
            {onCancel && (
              <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
                {cancelLabel}
              </Button>
            )}
            {onSubmit && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitDisabled || isLoading}
                variant={submitVariant === "destructive" ? "destructive" : "default"}
              >
                {isLoading ? "Processing..." : submitLabel}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
