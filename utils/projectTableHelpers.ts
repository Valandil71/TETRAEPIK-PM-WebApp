import type { LucideIcon } from "lucide-react";
import { Clock, CheckCircle2, XCircle, Circle } from "lucide-react";

/**
 * Get inline style object for system color indicator
 * @param system - System name
 * @param getSystemColorPreview - Function from useColorSettings hook to get color preview
 * @returns Style object with backgroundColor
 */
export function getSystemColorStyle(
  system: string,
  getSystemColorPreview: (system: string) => string
): React.CSSProperties {
  const color = getSystemColorPreview(system);
  if (color === "transparent" || !color) {
    return { backgroundColor: "transparent" };
  }
  return { backgroundColor: color };
}

/**
 * Get inline style object for language color indicator
 * @param langIn - Input language
 * @param langOut - Output language
 * @param getLanguageColorPreview - Function from useColorSettings hook to get color preview
 * @returns Style object with backgroundColor
 */
export function getLanguageColorStyle(
  langIn: string,
  langOut: string,
  getLanguageColorPreview: (langIn: string, langOut: string) => string
): React.CSSProperties {
  const color = getLanguageColorPreview(langIn || "", langOut || "");
  if (color === "transparent" || !color) {
    return { backgroundColor: "transparent" };
  }
  return { backgroundColor: color };
}

/**
 * Get status icon, color class, and label for assignment status
 * @param status - Assignment status: "claimed", "done", "rejected", or "unclaimed"
 * @returns Object with icon component, color class, and label
 */
export function getStatusIcon(status: string): {
  icon: LucideIcon;
  color: string;
  label: string;
} {
  switch (status) {
    case "claimed":
      return {
        icon: Clock,
        color: "text-blue-500",
        label: "In Progress",
      };
    case "done":
      return {
        icon: CheckCircle2,
        color: "text-green-500",
        label: "Done",
      };
    case "rejected":
      return {
        icon: XCircle,
        color: "text-red-500",
        label: "Rejected",
      };
    default: // unclaimed
      return {
        icon: Circle,
        color: "text-gray-400",
        label: "Unclaimed",
      };
  }
}
