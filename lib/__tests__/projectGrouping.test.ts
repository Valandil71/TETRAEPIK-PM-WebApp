import { describe, expect, it } from "vitest";
import {
  compareProjectsByClosestDeadline,
  groupProjectsForDisplay,
} from "@/lib/projectGrouping";

const makeProject = (
  id: number,
  name: string,
  options: {
    sap_subproject_id?: string | null;
    initial_deadline?: string | null;
    interim_deadline?: string | null;
    final_deadline?: string | null;
  } = {}
) => ({
  id,
  name,
  sap_subproject_id: options.sap_subproject_id ?? null,
  initial_deadline: options.initial_deadline ?? null,
  interim_deadline: options.interim_deadline ?? null,
  final_deadline: options.final_deadline ?? null,
});

describe("projectGrouping", () => {
  it("orders projects by the closest available deadline", () => {
    const projects = [
      makeProject(1, "Final Only", { final_deadline: "2026-04-27T13:00:00.000Z" }),
      makeProject(2, "Initial Only", { initial_deadline: "2026-04-23T07:00:00.000Z" }),
      makeProject(3, "No Deadline"),
    ];

    const ordered = [...projects].sort(compareProjectsByClosestDeadline);

    expect(ordered.map((project) => project.name)).toEqual([
      "Initial Only",
      "Final Only",
      "No Deadline",
    ]);
  });

  it("keeps the incoming order and splits non-adjacent rows of a subproject", () => {
    const orderedProjects = [
      makeProject(10, "Subproject B", {
        sap_subproject_id: "B",
        final_deadline: "2026-04-20T13:00:00.000Z",
      }),
      makeProject(20, "Subproject A", {
        sap_subproject_id: "A",
        initial_deadline: "2026-04-23T07:00:00.000Z",
      }),
      makeProject(30, "Subproject C", {
        sap_subproject_id: "C",
        final_deadline: "2026-04-24T13:00:00.000Z",
      }),
      makeProject(21, "Subproject A", {
        sap_subproject_id: "A",
        final_deadline: "2026-04-27T13:00:00.000Z",
      }),
    ];

    const groups = groupProjectsForDisplay(orderedProjects);

    expect(groups.map((group) => group.key)).toEqual([
      "sap:B",
      "sap:A",
      "sap:C",
      "sap:A#2",
    ]);
    expect(groups.map((group) => group.projects.map((project) => project.id))).toEqual([
      [10],
      [20],
      [30],
      [21],
    ]);
  });

  it("groups adjacent rows of the same subproject with unique keys per run", () => {
    const groups = groupProjectsForDisplay([
      makeProject(1, "Subproject A", { sap_subproject_id: "A" }),
      makeProject(2, "Subproject A", { sap_subproject_id: "A" }),
      makeProject(3, "Subproject B", { sap_subproject_id: "B" }),
      makeProject(4, "Subproject A", { sap_subproject_id: "A" }),
      makeProject(5, "Subproject A", { sap_subproject_id: "A" }),
      makeProject(6, "Subproject C", { sap_subproject_id: "C" }),
      makeProject(7, "Subproject A", { sap_subproject_id: "A" }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "sap:A",
      "sap:B",
      "sap:A#2",
      "sap:C",
      "sap:A#3",
    ]);
    expect(groups.map((group) => group.projects.map((project) => project.id))).toEqual([
      [1, 2],
      [3],
      [4, 5],
      [6],
      [7],
    ]);
    expect(new Set(groups.map((group) => group.key)).size).toBe(groups.length);
  });

  it("falls back to exact-name grouping when a subproject id is missing", () => {
    const groups = groupProjectsForDisplay([
      makeProject(1, "Manual Project"),
      makeProject(2, "Manual Project"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("name:Manual Project");
    expect(groups[0].projects.map((project) => project.id)).toEqual([1, 2]);
  });
});
