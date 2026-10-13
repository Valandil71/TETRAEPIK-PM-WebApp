import { describe, expect, it } from "vitest";
import { initialImportStatus, needsVolumeReview } from "@/lib/projects/reviewStatus";

describe("needsVolumeReview", () => {
  it("needs review when there are no lines and no words", () => {
    expect(needsVolumeReview({ system: "SSE", words: null, lines: null })).toBe(true);
    expect(needsVolumeReview({ system: "SSE", words: 0, lines: 0 })).toBe(true);
  });

  it("does not need review when lines or words exist", () => {
    expect(needsVolumeReview({ system: "SSE", words: null, lines: 6 })).toBe(false);
    expect(needsVolumeReview({ system: "DNW", words: 120, lines: null })).toBe(false);
  });

  it("treats XTM words ≤ 1 as a presence flag, not a count", () => {
    expect(needsVolumeReview({ system: "XTM", words: 1, lines: null })).toBe(true);
    expect(needsVolumeReview({ system: "XTM", words: 0, lines: null })).toBe(true);
    expect(needsVolumeReview({ system: "XTM", words: 250, lines: null })).toBe(false);
    expect(needsVolumeReview({ system: "XTM", words: 1, lines: 10 })).toBe(false);
  });

  it("ignores hours", () => {
    expect(needsVolumeReview({ system: "LAT", words: null, lines: null })).toBe(true);
  });
});

describe("initialImportStatus", () => {
  it("starts projects without volume as pending_review, others as active", () => {
    expect(initialImportStatus({ system: "SSE", words: null, lines: null })).toBe("pending_review");
    expect(initialImportStatus({ system: "SSE", words: null, lines: 6 })).toBe("active");
  });
});
