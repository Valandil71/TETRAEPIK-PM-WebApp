import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  invalidateProjectListsForAssignment,
  invalidateProjectListsForStatuses,
} from "@/components/providers/RealtimeProvider";

const activeList = queryKeys.projectsWithTranslators(false, true, "active");
const projectTable = queryKeys.projectsWithTranslators(false, false, "active");
const completeList = queryKeys.projectsWithTranslators(false, true, "complete");

function setup() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(activeList, [{ id: 1 }, { id: 2 }]);
  queryClient.setQueryData(projectTable, [{ id: 1 }]);
  queryClient.setQueryData(completeList, [{ id: 10 }]);
  const invalidated = () =>
    [activeList, projectTable, completeList].map(
      (key) => queryClient.getQueryState(key)?.isInvalidated ?? false
    );
  return { queryClient, invalidated };
}

describe("invalidateProjectListsForStatuses", () => {
  it("leaves the completed list alone for changes to active projects", () => {
    const { queryClient, invalidated } = setup();
    invalidateProjectListsForStatuses(queryClient, ["active", "active"]);
    expect(invalidated()).toEqual([true, true, false]);
  });

  it("leaves active lists alone for invoicing updates on completed projects", () => {
    const { queryClient, invalidated } = setup();
    invalidateProjectListsForStatuses(queryClient, ["complete", "complete"]);
    expect(invalidated()).toEqual([false, false, true]);
  });

  it("refreshes both when a project is marked complete", () => {
    const { queryClient, invalidated } = setup();
    invalidateProjectListsForStatuses(queryClient, ["complete", "active"]);
    expect(invalidated()).toEqual([true, true, true]);
  });

  it("refreshes the Manage Projects list for active and to-review changes only", () => {
    const queryClient = new QueryClient();
    const managementList = queryKeys.projectsWithTranslators(false, true, "management");
    const isInvalidated = () => queryClient.getQueryState(managementList)?.isInvalidated;

    queryClient.setQueryData(managementList, [{ id: 1 }]);
    invalidateProjectListsForStatuses(queryClient, ["complete", "complete"]);
    expect(isInvalidated()).toBe(false);

    invalidateProjectListsForStatuses(queryClient, ["active", "pending_review"]);
    expect(isInvalidated()).toBe(true);

    queryClient.setQueryData(managementList, [{ id: 1 }]);
    invalidateProjectListsForStatuses(queryClient, ["pending_review", "pending_review"]);
    expect(isInvalidated()).toBe(true);
  });

  it("refreshes every list when the payload has no status", () => {
    const { queryClient, invalidated } = setup();
    invalidateProjectListsForStatuses(queryClient, [undefined, undefined]);
    expect(invalidated()).toEqual([true, true, true]);
  });
});

describe("invalidateProjectListsForAssignment", () => {
  it("only refreshes lists that contain the project", () => {
    const { queryClient, invalidated } = setup();
    invalidateProjectListsForAssignment(queryClient, 2);
    expect(invalidated()).toEqual([true, false, false]);
  });

  it("refreshes every list when the project is unknown", () => {
    const { queryClient, invalidated } = setup();
    invalidateProjectListsForAssignment(queryClient, undefined);
    expect(invalidated()).toEqual([true, true, true]);
  });
});
