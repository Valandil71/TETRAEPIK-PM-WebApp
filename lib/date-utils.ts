import { format } from "date-fns";

/**
 * Format a stored timestamp as the value of an `<input type="datetime-local">`
 * (local date and time, yyyy-MM-ddTHH:mm).
 */
export function toDateTimeInputValue(date: string | null | undefined): string {
  if (!date) return "";
  const parsed = new Date(date);
  if (isNaN(parsed.getTime())) return "";
  return format(parsed, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Convert an `<input type="datetime-local">` value (local time) back to a timestamp for the
 * database. When the date and time did not change, the original timestamp is returned
 * untouched, so its seconds are not lost.
 */
export function dateTimeInputToTimestamp(
  input: string | null | undefined,
  original: string | null | undefined
): string | null {
  if (!input) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2})?$/.exec(input);
  if (!match) return null;

  if (original && toDateTimeInputValue(original) === input) return original;

  const [, year, month, day, hours, minutes] = match.map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  return isNaN(date.getTime()) ? null : date.toISOString();
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
