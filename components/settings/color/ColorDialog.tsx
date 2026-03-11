"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorSetting } from "../ColorSettings";
import { ColorForm } from "./ColorForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: ColorSetting | null;
  refresh: () => void;
}

export function ColorDialog({ open, onOpenChange, editing, refresh }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Color" : "Add Color"}</DialogTitle>
        </DialogHeader>
        <ColorForm editing={editing} onDone={refresh} closeDialog={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
