import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  COMPLETED_PREVIEW_ROWS,
  useCompletedProjects,
} from "@/hooks/project/useCompletedProjects";

interface RecordedQuery {
  table: string;
  filters: Array<[string, ...unknown[]]>;
}

const recorded: RecordedQuery[] = [];
// The full list's pages wait for this, so the preview can be seen on its own
let releaseFullList = () => {};
let fullListReady = Promise.resolve();

const isPreview = (query: RecordedQuery) => query.filters.some(([name]) => name === "limit");

const row = (id: number) => ({
  id,
  name: `P${id}`,
  instructions: null,
  status: "complete",
  initial_deadline: null,
  interim_deadline: null,
  final_deadline: "2026-01-01",
  projects_assignment: [{ assignment_status: "done", done_message: null, user_id: "u1" }],
});

function from(table: string) {
  const query: RecordedQuery = { table, filters: [] };
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      query.filters.push([name, ...args]);
      return builder;
    };
  const builder = {
    select: record("select"),
    eq: record("eq"),
    in: record("in"),
    or: record("or"),
    order: record("order"),
    range: record("range"),
    limit: record("limit"),
    then(onFulfilled: (value: { data: unknown[]; error: null }) => unknown) {
      recorded.push(query);
      if (table === "users") {
        return Promise.resolve({ data: [{ id: "u1", name: "Ana", role: "employee" }], error: null }).then(onFulfilled);
      }
      if (isPreview(query)) {
        return Promise.resolve({ data: [row(1), row(2)], error: null }).then(onFulfilled);
      }
      const isFirstPage = query.filters.some(([name, start]) => name === "range" && start === 0);
      return fullListReady
        .then(() => ({ data: isFirstPage ? [row(1), row(2), row(3)] : [], error: null }))
        .then(onFulfilled);
    },
  };
  return builder;
}

vi.mock("@/hooks/core/useSupabase", () => ({
  useSupabase: () => ({ from }),
}));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useCompletedProjects", () => {
  beforeEach(() => {
    recorded.length = 0;
    fullListReady = new Promise<void>((done) => (releaseFullList = done));
  });

  it("shows the preview while the full list loads, then switches to the full list", async () => {
    const { result } = renderHook(
      () => useCompletedProjects({ order: "asc", filter: "notFullyProcessed" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isPartial).toBe(true));
    expect(result.current.projects!.map((p) => p.id)).toEqual([1, 2]);
    expect(result.current.projects![0].translators[0].name).toBe("Ana");

    // One small request, in the page's order, with the tab's filter
    const preview = recorded.find(isPreview)!;
    expect(preview.filters).toContainEqual(["eq", "status", "complete"]);
    expect(preview.filters).toContainEqual(["or", "invoiced.eq.false,paid.eq.false"]);
    expect(preview.filters).toContainEqual([
      "order",
      "closest_deadline",
      { ascending: true, nullsFirst: false },
    ]);
    expect(preview.filters).toContainEqual(["limit", COMPLETED_PREVIEW_ROWS]);

    releaseFullList();
    await waitFor(() => expect(result.current.isPartial).toBe(false));
    expect(result.current.projects!.map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it("waits for the full list when no preview can be used", async () => {
    const { result } = renderHook(() => useCompletedProjects(null), { wrapper });

    await waitFor(() => expect(recorded.some((q) => q.table === "projects")).toBe(true));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.projects).toBeUndefined();
    expect(recorded.some(isPreview)).toBe(false);

    releaseFullList();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isPartial).toBe(false);
    expect(result.current.projects).toHaveLength(3);
  });
});
