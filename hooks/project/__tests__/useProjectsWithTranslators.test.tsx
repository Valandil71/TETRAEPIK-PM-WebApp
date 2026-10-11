import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PROJECT_LIST_PAGE_SIZE,
  useProjectsWithTranslators,
} from "@/hooks/project/useProjectsWithTranslators";
import {
  pickSapInstructionPreview,
  useSapInstructionPreviews,
} from "@/hooks/project/useSapInstructionPreviews";
import { getInstructionsPreview } from "@/utils/instructionsPreview";
import type { SapInstructionEntry } from "@/types/project";

interface RecordedQuery {
  table: string;
  select: string;
  filters: Array<[string, ...unknown[]]>;
}

type Resolver = (query: RecordedQuery) => unknown[];

const recorded: RecordedQuery[] = [];
let resolve: Resolver = () => [];

// Minimal thenable stand-in for the supabase-js query builder.
function from(table: string) {
  const query: RecordedQuery = { table, select: "", filters: [] };
  const builder = {
    select(columns: string) {
      query.select = columns.replace(/\s+/g, " ").trim();
      return builder;
    },
    order(...args: unknown[]) {
      query.filters.push(["order", ...args]);
      return builder;
    },
    eq(...args: unknown[]) {
      query.filters.push(["eq", ...args]);
      return builder;
    },
    in(...args: unknown[]) {
      query.filters.push(["in", ...args]);
      return builder;
    },
    not(...args: unknown[]) {
      query.filters.push(["not", ...args]);
      return builder;
    },
    range(...args: unknown[]) {
      query.filters.push(["range", ...args]);
      return builder;
    },
    then(onFulfilled: (value: { data: unknown[]; error: null }) => unknown) {
      recorded.push(query);
      return Promise.resolve({ data: resolve(query), error: null }).then(onFulfilled);
    },
  };
  return builder;
}

vi.mock("@/hooks/core/useSupabase", () => ({
  useSupabase: () => ({ from }),
}));

const entry = (text: string): SapInstructionEntry => ({
  instructionShort: text,
  instructionLong: text,
});

const user = { id: "u1", name: "Ana", short_name: "AN", role: "translator", avatar: null };

const projectRow = (id: number, instructions: string | null, assignments: unknown[] = []) => ({
  id,
  name: `P${id}`,
  instructions,
  status: "active",
  initial_deadline: null,
  interim_deadline: null,
  final_deadline: "2099-01-01",
  projects_assignment: assignments,
});

const sapByProject: Record<number, SapInstructionEntry[] | null> = {
  1: [entry("Manual project SAP")],
  2: [entry("Visible first"), entry("Second")],
  3: [entry("Boilerplate"), entry("Hidden behind boilerplate")],
  4: [entry("Boilerplate")],
  5: null,
};

function defaultResolver(query: RecordedQuery): unknown[] {
  if (query.table === "instruction_exclusions_v2") {
    return [{ id: 1, normalized_text: "boilerplate", is_active: true }];
  }
  const inFilter = query.filters.find(([name]) => name === "in");
  if (!inFilter) {
    if (pageStart(query) > 0) return [];
    return [
      projectRow(1, "Use glossary", [{ assignment_status: "claimed", done_message: null, users: user }]),
      projectRow(2, null),
      projectRow(3, "   "),
      projectRow(4, ""),
      projectRow(5, null),
    ];
  }
  const ids = inFilter[2] as number[];
  const withSap = ids.filter((id) => sapByProject[id]);
  if (query.select.includes("sap_first")) {
    return withSap.map((id) => ({ id, sap_first: sapByProject[id]![0] }));
  }
  return withSap.map((id) => ({ id, sap_instructions: sapByProject[id] }));
}

function pageStart(query: RecordedQuery): number {
  return (query.filters.find(([name]) => name === "range")?.[1] as number) ?? 0;
}

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("pickSapInstructionPreview", () => {
  it("keeps a visible first entry and rejects empty or excluded ones", () => {
    const exclusions = new Set(["boilerplate"]);
    expect(pickSapInstructionPreview(entry("Hello"), exclusions)).toEqual([entry("Hello")]);
    expect(pickSapInstructionPreview(entry("<b>Boilerplate</b>"), exclusions)).toBeNull();
    expect(pickSapInstructionPreview(entry(""), exclusions)).toBeNull();
    expect(pickSapInstructionPreview(null, exclusions)).toBeNull();
  });
});

describe("useProjectsWithTranslators", () => {
  beforeEach(() => {
    recorded.length = 0;
    resolve = defaultResolver;
  });

  it("does not select sap_instructions in the list and embeds assignments", async () => {
    const { result } = renderHook(() => useProjectsWithTranslators(false, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const listQuery = recorded[0];
    expect(listQuery.table).toBe("projects");
    expect(listQuery.select).not.toContain("sap_instructions");
    expect(listQuery.select).toContain("projects_assignment (");
    expect(listQuery.filters).toContainEqual(["eq", "status", "active"]);
    expect(recorded.some((q) => q.table === "projects_assignment")).toBe(false);

    const p1 = result.current.data!.find((p) => p.id === 1)!;
    expect(p1.translators).toEqual([
      { ...user, short_name: "AN", assignment_status: "claimed", avatar: null, done_message: null },
    ]);
    expect(p1).not.toHaveProperty("projects_assignment");
  });

  it("only loads SAP data for projects without manual instructions", async () => {
    const { result } = renderHook(() => useProjectsWithTranslators(false, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstEntryQuery = recorded.find((q) => q.select.includes("sap_first"))!;
    expect(firstEntryQuery.filters).toContainEqual(["in", "id", [2, 3, 4, 5]]);

    // Only the projects whose first entry is excluded need the full array
    const fullQuery = recorded.find((q) => q.select === "id, sap_instructions")!;
    expect(fullQuery.filters).toContainEqual(["in", "id", [3, 4]]);

    const byId = new Map(result.current.data!.map((p) => [p.id, p]));
    expect(byId.get(1)!.sap_instructions).toBeNull();
    expect(byId.get(2)!.sap_instructions).toEqual([entry("Visible first")]);
    expect(byId.get(3)!.sap_instructions).toEqual(sapByProject[3]);
    expect(byId.get(5)!.sap_instructions).toBeNull();
  });

  it("produces the same previews as the full data would", async () => {
    const { result } = renderHook(() => useProjectsWithTranslators(false, true), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const exclusionSet = new Set(["boilerplate"]);
    for (const project of result.current.data!) {
      const trimmed = getInstructionsPreview({
        instructions: project.instructions,
        sapInstructions: project.sap_instructions,
        exclusionSet,
      });
      const full = getInstructionsPreview({
        instructions: project.instructions,
        sapInstructions: sapByProject[project.id],
        exclusionSet,
      });
      expect(trimmed).toEqual(full);
    }
  });

  it("loads every completed project page by page and skips SAP data", async () => {
    const total = PROJECT_LIST_PAGE_SIZE * 2 + 25;
    const rows = Array.from({ length: total }, (_, i) => projectRow(i + 1, null));
    resolve = (query) => {
      const from = pageStart(query);
      return rows.slice(from, from + PROJECT_LIST_PAGE_SIZE);
    };

    const { result } = renderHook(() => useProjectsWithTranslators(false, true, "complete"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(total);
    expect(recorded.map((q) => q.filters.find(([name]) => name === "range"))).toEqual([
      ["range", 0, 999],
      ["range", 1000, 1999],
      ["range", 2000, 2999],
    ]);
    expect(recorded.every((q) => q.filters.some((f) => f[0] === "eq" && f[2] === "complete"))).toBe(true);
    // Completed lists load SAP previews per visible page instead
    expect(recorded.some((q) => q.select.includes("sap"))).toBe(false);
    expect(result.current.data!.every((p) => p.sap_instructions === null)).toBe(true);
  });
});

describe("useSapInstructionPreviews", () => {
  beforeEach(() => {
    recorded.length = 0;
    resolve = defaultResolver;
  });

  it("fills previews for the visible rows only, matching the full data", async () => {
    const groups = [
      { key: "a", name: "A", projects: [1, 2, 3].map((id) => ({ id, instructions: id === 1 ? "Use glossary" : null, sap_instructions: null })) },
      { key: "b", name: "B", projects: [4].map((id) => ({ id, instructions: "", sap_instructions: null })) },
    ];

    const { result } = renderHook(() => useSapInstructionPreviews(groups), { wrapper });
    await waitFor(() => expect(result.current[0].projects[1].sap_instructions).not.toBeNull());

    const firstEntryQuery = recorded.find((q) => q.select.includes("sap_first"))!;
    expect(firstEntryQuery.filters).toContainEqual(["in", "id", [2, 3, 4]]);

    const exclusionSet = new Set(["boilerplate"]);
    for (const project of result.current.flatMap((group) => group.projects)) {
      expect(
        getInstructionsPreview({ instructions: project.instructions, sapInstructions: project.sap_instructions, exclusionSet })
      ).toEqual(
        getInstructionsPreview({ instructions: project.instructions, sapInstructions: sapByProject[project.id], exclusionSet })
      );
    }
  });

  it("chunks large id lists", async () => {
    const groups = [{ key: "a", name: "A", projects: Array.from({ length: 450 }, (_, i) => ({ id: i + 1, instructions: null })) }];
    resolve = () => [];

    renderHook(() => useSapInstructionPreviews(groups), { wrapper });
    await waitFor(() => expect(recorded.length).toBe(3));

    expect(recorded.map((q) => (q.filters.find(([name]) => name === "in")![2] as number[]).length)).toEqual([200, 200, 50]);
  });
});
