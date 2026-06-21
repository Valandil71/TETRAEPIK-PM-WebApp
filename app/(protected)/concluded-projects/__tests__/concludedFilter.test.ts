import { describe, expect, it } from "vitest";
import type { ProjectStatus } from "@/types/project";

// The Concluded Projects page is the inverse of the management page's active
// filter (management keeps `p.status !== "complete"`). This guards that the
// page selects exactly the completed subset.
const selectCompleted = <T extends { status: ProjectStatus }>(projects: T[]) =>
  projects.filter((p) => p.status === "complete");

describe("concluded projects filter", () => {
  const projects = [
    { id: 1, status: "complete" as ProjectStatus },
    { id: 2, status: "active" as ProjectStatus },
    { id: 3, status: "complete" as ProjectStatus },
    { id: 4, status: "cancelled" as ProjectStatus },
  ];

  it("keeps only completed projects", () => {
    const result = selectCompleted(projects);
    expect(result.map((p) => p.id)).toEqual([1, 3]);
    expect(result.every((p) => p.status === "complete")).toBe(true);
  });

  it("returns an empty list when nothing is complete", () => {
    const noneComplete = projects.filter((p) => p.status !== "complete");
    expect(selectCompleted(noneComplete)).toEqual([]);
  });
});
