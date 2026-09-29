/**
 * Helper functions for filtering projects
 */

const LISBON_TZ = "Europe/Lisbon";
const lisbonDateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: LISBON_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's calendar date in Europe/Lisbon, as YYYY-MM-DD. */
export function getTodayInLisbon(now: Date = new Date()): string {
  return lisbonDateFormat.format(now);
}

/** Caps a YYYY-MM-DD value at `max` (inclusive); empty stays empty. */
export function clampDateToMax(value: string, max?: string): string {
  return value && max && value > max ? max : value;
}

/** Due-date presets that look backwards (used by pages listing past work). */
export const PAST_DUE_DATE_OPTIONS = [
  "Today",
  "Yesterday",
  "Last 3 days",
  "Last week",
  "Last month",
  "Custom date",
];

function toLisbonDay(value: string): string {
  return value.length > 10 ? getTodayInLisbon(new Date(value)) : value;
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function matchesPastDueDateFilter(
  dueDate: string,
  filter: string
): boolean | null {
  // Days elapsed since the deadline, Lisbon calendar (0 = today).
  const ago = dayNumber(getTodayInLisbon()) - dayNumber(toLisbonDay(dueDate));
  switch (filter) {
    case "Yesterday":
      return ago === 1;
    case "Last 3 days":
      return ago >= 0 && ago <= 3;
    case "Last week":
      return ago >= 0 && ago <= 7;
    case "Last month":
      return ago >= 0 && ago <= 30;
    default:
      return null;
  }
}

export function matchesDueDateFilter(
  dueDate: string | null,
  filter: string | null,
  customDate?: string,
  calendar: "local" | "lisbon" = "local"
): boolean {
  if (!filter || !dueDate) return true;

  const past = matchesPastDueDateFilter(dueDate, filter);
  if (past !== null) return past;

  if (calendar === "lisbon") {
    if (filter === "Today") return toLisbonDay(dueDate) === getTodayInLisbon();
    if (filter === "Custom date" && customDate) {
      return toLisbonDay(dueDate) <= customDate;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const projectDate = new Date(dueDate);
  projectDate.setHours(0, 0, 0, 0);
  const diffTime = projectDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (filter === "Custom date" && customDate) {
    const custom = new Date(customDate);
    custom.setHours(0, 0, 0, 0);
    return projectDate <= custom;
  }

  switch (filter) {
    case "Today":
      return diffDays === 0;
    case "In 1 day":
      return diffDays === 1;
    case "In 3 days":
      return diffDays >= 0 && diffDays <= 3;
    case "In a week":
      return diffDays >= 0 && diffDays <= 7;
    case "In a month":
      return diffDays >= 0 && diffDays <= 30;
    default:
      return true;
  }
}

export function matchesLengthFilter(words: number | null, lines: number | null, filter: string | null): boolean {
  if (!filter) return true;

  switch (filter) {
    case "Short":
      // "Short" = has lines (lines is not null and not 0)
      return lines !== null && lines !== 0;
    case "Long":
      // "Long" = has words (words is not null and not 0), or both are 0/null (default)
      return (words !== null && words !== 0) || (!lines || lines === 0);
    default:
      return true;
  }
}
