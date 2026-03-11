"use client";

import { ColorSetting } from "../ColorSettings";
import { ColorCard } from "./ColorCard";

interface Props {
  settings: ColorSetting[];
  onEdit: (s: ColorSetting) => void;
  onDelete: (id: number) => void;
}

export function ColorList({ settings, onEdit, onDelete }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {settings.map((s) => (
        <ColorCard key={s.id} setting={s} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
