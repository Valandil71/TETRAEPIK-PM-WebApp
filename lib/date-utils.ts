import { format } from "date-fns";

/**
 * Format a stored timestamp as the value of an `<input type="date">` (local date, yyyy-MM-dd).
 */
export function toDateInputValue(date: string | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "";
  return format(parsed, "yyyy-MM-dd");
}

/**
 * Convert an `<input type="date">` value back to a timestamp for the database without
 * losing the time of day of the stored deadline (SAP deadlines carry a time):
 * - date unchanged → the original timestamp is returned untouched
 * - date changed   → the new day keeps the original local time of day
 * - no original    → midnight UTC of the chosen day
 */
export function dateInputToTimestamp(
  input: string | null | undefined,
  original: string | null | undefined
): string | null {
  if (!input) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return null;

  const originalDate = original ? new Date(original) : null;
  if (!originalDate || isNaN(originalDate.getTime())) {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (toDateInputValue(original) === input) return original!;

  const [, year, month, day] = match;
  const updated = new Date(originalDate);
  updated.setFullYear(Number(year), Number(month) - 1, Number(day));
  return updated.toISOString();
}

/**
 * Count the number of working days (Mon-Fri) between two dates.
 * Both start and end dates are inclusive.
 */
export function countWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}
