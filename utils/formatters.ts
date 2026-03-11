export function formatNumber(value: number): string {
  return value.toLocaleString("de-DE"); // 1.234 style
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  // Input like "2025-11-25T00:00:00Z" or "2025-11-25"
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  }); // e.g. "25 Nov"
}

/** Format date with time, e.g. "25 Nov 14:00" */
export function formatDateWithTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
  const timePart = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${datePart} ${timePart}`;
}

/** Replace underscores with spaces in project names */
export function formatProjectName(name: string): string {
  return name.replace(/_/g, " ");
}

/** Strip HTML tags and decode common HTML entities from a string */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&eacute;/gi, "\u00e9")
    .replace(/&egrave;/gi, "\u00e8")
    .replace(/&agrave;/gi, "\u00e0")
    .replace(/&uuml;/gi, "\u00fc")
    .replace(/&ouml;/gi, "\u00f6")
    .replace(/&auml;/gi, "\u00e4")
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Format a value for display in conflict modals.
 * Handles null, booleans, dates, numbers, arrays, and strings.
 */
export function formatConflictValue(
  value: unknown,
  options?: { emptyText?: string; truncateAt?: number }
): string {
  const empty = options?.emptyText ?? "—";
  const truncateAt = options?.truncateAt ?? 50;

  if (value === null || value === undefined) return empty;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (value === "") return empty;
    // Check if it's a date string
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        return date.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return value;
      }
    }
    if (truncateAt > 0 && value.length > truncateAt) {
      return value.substring(0, truncateAt) + "...";
    }
    return value;
  }
  if (typeof value === "number") return value.toLocaleString();
  if (Array.isArray(value)) return `${value.length} item(s)`;
  if (value instanceof Date) {
    return value.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
  return String(value);
}

/** Human-readable display names for user roles */
export const ROLE_DISPLAY: Record<string, string> = {
  employee: "Collaborator",
  pm: "PM",
  admin: "Admin",
};

/** Get display name for a role, with fallback */
export function formatRoleDisplay(role: string): string {
  return ROLE_DISPLAY[role] || role;
}

