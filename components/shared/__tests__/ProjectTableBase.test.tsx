import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectTableBase } from "@/components/shared/ProjectTableBase";

interface Row {
  id: number;
  system: string;
  name: string;
}

const rows: Row[] = [
  { id: 1, system: "Trados", name: "Project A" },
  { id: 2, system: "MemoQ", name: "Project B" },
];

const columns = [
  { header: "System", render: (r: Row) => r.system },
  { header: "Project name", render: (r: Row) => r.name },
];

function renderTable(items: Row[], stickyHeader: boolean) {
  return render(
    <ProjectTableBase
      items={items}
      columns={columns}
      emptyStateTitle="No projects"
      getRowKey={(r) => r.id}
      stickyHeader={stickyHeader}
    />,
  );
}

describe("ProjectTableBase sticky header", () => {
  it("renders the configured header cells", () => {
    renderTable(rows, true);
    expect(screen.getByText("System")).toBeInTheDocument();
    expect(screen.getByText("Project name")).toBeInTheDocument();
  });

  it("applies sticky positioning to the header when stickyHeader is set", () => {
    const { container } = renderTable(rows, true);
    const thead = container.querySelector("thead") as HTMLElement;
    expect(thead.className).toContain("sticky");
    expect(thead.className).toContain("z-20");
    // top is an inline style (the header offset), defaulting to 0px.
    expect(thead.style.top).toBe("0px");
  });

  it("offsets the sticky header by headerOffset (e.g. a page filter bar)", () => {
    const { container } = render(
      <ProjectTableBase
        items={rows}
        columns={columns}
        emptyStateTitle="No projects"
        getRowKey={(r) => r.id}
        stickyHeader
        headerOffset={120}
      />,
    );
    const thead = container.querySelector("thead") as HTMLElement;
    expect(thead.style.top).toBe("120px");
  });

  it("does not wrap the table in an overflow container that breaks sticky", () => {
    // overflow-hidden / overflow-x-auto ancestors clip position: sticky on the
    // vertical axis. In sticky mode the card uses overflow-x-clip instead and the
    // inner wrapper drops overflow-x-auto.
    const { container } = renderTable(rows, true);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("overflow-x-clip");
    expect(card.className).not.toContain("overflow-hidden");

    const innerWrapper = card.firstElementChild as HTMLElement;
    expect(innerWrapper.className ?? "").not.toContain("overflow-x-auto");
  });

  it("does not apply sticky classes when stickyHeader is false", () => {
    const { container } = renderTable(rows, false);
    const thead = container.querySelector("thead");
    expect(thead?.className ?? "").not.toContain("sticky");

    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain("overflow-hidden");
  });

  it("shows the empty state when there are no rows", () => {
    renderTable([], true);
    expect(screen.getByText("No projects")).toBeInTheDocument();
  });
});
