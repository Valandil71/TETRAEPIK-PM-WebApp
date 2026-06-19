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

  it("groups SAP projects by subproject id in the position of their first appearance", () => {
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

    expect(groups.map((group) => group.key)).toEqual(["sap:B", "sap:A", "sap:C"]);
    expect(groups[1].projects.map((project) => project.id)).toEqual([20, 21]);
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
