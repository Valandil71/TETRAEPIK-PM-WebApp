/**
 * Helper functions for filtering projects
 */

export function matchesDueDateFilter(
  dueDate: string | null,
  filter: string | null,
  customDate?: string
): boolean {
  if (!filter || !dueDate) return true;

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
