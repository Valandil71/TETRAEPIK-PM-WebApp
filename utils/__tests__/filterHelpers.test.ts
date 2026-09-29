import { afterEach, describe, expect, it, vi } from "vitest";
import { getTodayInLisbon, matchesDueDateFilter } from "@/utils/filterHelpers";

afterEach(() => vi.useRealTimers());

describe("past due-date filters in Lisbon", () => {
  it("uses Lisbon's date just after midnight, even while UTC is yesterday", () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = "UTC";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-28T23:30:00Z"));
    try {
      expect(getTodayInLisbon()).toBe("2026-09-29");
      expect(matchesDueDateFilter("2026-09-28", "Yesterday")).toBe(true);
      expect(matchesDueDateFilter("2026-09-29", "Today", undefined, "lisbon")).toBe(true);
      expect(matchesDueDateFilter("2026-09-30", "Today", undefined, "lisbon")).toBe(false);
    } finally {
      if (previousTimeZone === undefined) delete process.env.TZ;
      else process.env.TZ = previousTimeZone;
    }
  });
});
