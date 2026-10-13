import { describe, expect, it } from "vitest";
import {
  categorizeManagementProjects,
  getManagementCategory,
} from "@/lib/projects/managementTabs";

const t = (assignment_status: string) => ({ assignment_status });

describe("getManagementCategory", () => {
  it("puts projects to review only in To Review, whatever their collaborators", () => {
    expect(getManagementCategory({ status: "pending_review", translators: [] })).toBe("toReview");
    expect(getManagementCategory({ status: "pending_review", translators: [t("claimed")] })).toBe(
      "toReview"
    );
  });

  it("splits active projects by collaborator progress", () => {
    expect(getManagementCategory({ status: "active", translators: [] })).toBe("unclaimed");
    expect(getManagementCategory({ status: "active", translators: [t("done"), t("done")] })).toBe(
      "ready"
    );
    expect(getManagementCategory({ status: "active", translators: [t("claimed"), t("done")] })).toBe(
      "inProgress"
    );
    expect(getManagementCategory({ status: "active", translators: [t("unclaimed")] })).toBe(
      "unclaimed"
    );
  });
});

describe("categorizeManagementProjects", () => {
  it("keeps projects to review out of Awaiting Assignment", () => {
    const toReview = { id: 1, status: "pending_review" as const, translators: [] };
    const unassigned = { id: 2, status: "active" as const, translators: [] };
    const result = categorizeManagementProjects([toReview, unassigned]);
    expect(result.toReview).toEqual([toReview]);
    expect(result.unclaimed).toEqual([unassigned]);
  });
});
