import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MyProjectsTable } from "@/components/my-projects/MyProjectsTable";
import { MyProjectsCard } from "@/components/my-projects/MyProjectsCard";
import { DoneDialog } from "@/components/my-projects/DoneDialog";
import { BulkClaimDialog } from "@/components/my-projects/BulkClaimDialog";
import { useProjectSelection } from "@/hooks/project/useProjectSelection";
import type { ProjectAssignment } from "@/types/project-assignment";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

function assignment(id: number, name: string): ProjectAssignment {
  return {
    id: String(id),
    project_id: String(id),
    user_id: "me",
    assignment_status: "unclaimed",
    initial_message: null,
    projects: {
      id,
      name,
      system: "XTM",
      words: 10,
      lines: null,
      status: "active",
      language_in: "enUS",
      language_out: "ptPT",
      initial_deadline: null,
      interim_deadline: null,
      final_deadline: "2026-11-01T10:00:00Z",
    },
  };
}

const noop = () => {};
const baseProps = { onClaim: noop, onReject: noop, onDone: noop, onSelectMultiple: noop };

describe("My Projects bulk actions menu", () => {
  it("offers the three-dots menu only when the tab has more than one project", () => {
    const { rerender } = render(
      <MyProjectsTable {...baseProps} activeTab="unclaimed" projects={[assignment(1, "A")]} />
    );
    expect(screen.queryByLabelText("More actions")).not.toBeInTheDocument();

    rerender(
      <MyProjectsTable
        {...baseProps}
        activeTab="unclaimed"
        projects={[assignment(1, "A"), assignment(2, "B")]}
      />
    );
    expect(screen.getAllByLabelText("More actions")).toHaveLength(2);
  });

  it("hides the per-row actions and shows checkboxes while selecting", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(2));

    render(
      <MyProjectsCard
        {...baseProps}
        activeTab="inProgress"
        projects={[assignment(1, "A"), assignment(2, "B")]}
        selection={result.current}
      />
    );
    expect(screen.queryByText("Done")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("More actions")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Select B")).toHaveAttribute("data-state", "checked");
    expect(screen.getByLabelText("Select A")).toHaveAttribute("data-state", "unchecked");
  });

  it("selects a row on press instead of opening the project", () => {
    const { result } = renderHook(() => useProjectSelection());
    act(() => result.current.start(1));
    const { rerender } = render(
      <MyProjectsTable
        {...baseProps}
        activeTab="unclaimed"
        projects={[assignment(1, "A"), assignment(2, "B")]}
        selection={result.current}
      />
    );
    const rowB = screen.getByText("B").closest("tr")!;
    fireEvent.pointerDown(rowB, { button: 0 });
    fireEvent.click(rowB);
    rerender(
      <MyProjectsTable
        {...baseProps}
        activeTab="unclaimed"
        projects={[assignment(1, "A"), assignment(2, "B")]}
        selection={result.current}
      />
    );
    expect(result.current.isSelected(2)).toBe(true);
    expect(push).not.toHaveBeenCalled();
  });
});

describe("bulk dialogs", () => {
  it("DoneDialog lists every project and applies one optional note", () => {
    const onConfirm = vi.fn();
    render(
      <DoneDialog
        open
        projectName=""
        projectNames={["Project A", "Project B"]}
        onConfirm={onConfirm}
        onCancel={noop}
      />
    );
    expect(screen.getByText("Mark 2 Projects as Done")).toBeInTheDocument();
    expect(screen.getByText("Project A")).toBeInTheDocument();
    expect(screen.getByText("Project B")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Mark as Done"));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it("BulkClaimDialog shows each custom instruction before claiming", () => {
    const onClaim = vi.fn();
    render(
      <BulkClaimDialog
        open
        projectCount={3}
        instructions={[{ projectId: 1, projectName: "Project A", message: "Use the glossary" }]}
        onClaim={onClaim}
        onCancel={noop}
      />
    );
    expect(screen.getByText("Use the glossary")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Got it, Claim 3 Projects"));
    expect(onClaim).toHaveBeenCalled();
  });
});
