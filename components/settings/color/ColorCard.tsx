"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ColorSetting } from "../ColorSettings";
import { getColorPreview, getBgClass } from "@/utils/tailwindColors";

interface Props {
  setting: ColorSetting;
  onEdit: (s: ColorSetting) => void;
  onDelete: (id: number) => void;
}

export function ColorCard({ setting, onEdit, onDelete }: Props) {
  // Get the preview color - either from Tailwind map or as fallback hex
  const previewColor = getColorPreview(setting.color_value);
  
  // Check if it's a light color to determine text color
  const isLightColor = (): boolean => {
    // For Tailwind classes, check the shade number
    const parts = setting.color_value.split("-");
    if (parts.length === 2) {
      const shade = parseInt(parts[1], 10);
      return shade <= 400; // 50-400 are generally light
    }
    // For special colors
    if (setting.color_value === "white" || setting.color_value === "transparent") {
      return true;
    }
    return false;
  };

  const textColorClass = isLightColor() ? "text-gray-800" : "text-white";
  const generatedDescription =
    setting.category === "system"
      ? `System: ${setting.system_name ?? ""}`
      : setting.category === "status"
        ? `Status: ${setting.status_key ?? ""}`
        : `Lang: ${setting.language_in ?? ""} -> ${setting.language_out ?? ""}`;

  return (
    <div className="border rounded-lg p-4 space-y-2 bg-card">
      <div
        className={`h-10 rounded flex items-center justify-center font-mono text-sm shadow-sm ${textColorClass}`}
        style={{ backgroundColor: previewColor }}
      >
        <span className="px-2 py-0.5 rounded bg-black/10 backdrop-blur-sm">
          {setting.color_value}
        </span>
      </div>

      <div className="text-xs text-muted-foreground flex items-center gap-2">
        <span className="font-semibold">Category:</span>
        <span className="px-2 py-0.5 rounded bg-muted">
          {setting.category.toUpperCase()}
        </span>
      </div>

      <div className="text-xs text-muted-foreground">
        <span className="font-semibold">Tailwind class:</span>{" "}
        <code className="px-1.5 py-0.5 bg-muted rounded font-mono">
          {getBgClass(setting.color_value)}
        </code>
      </div>

      <div className="flex items-center justify-between pt-2">
        <div className="text-xs">{setting.description || generatedDescription}</div>

        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={() => onEdit(setting)}>
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => onDelete(setting.id)}>
            <Trash2 className="w-4 h-4 text-red-600" />
          </Button>
        </div>
      </div>
    </div>
  );
}


