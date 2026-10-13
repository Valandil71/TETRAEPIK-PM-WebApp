import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TruncatedText } from "@/components/shared/TruncatedText";

const toastSuccess = vi.fn();
vi.mock("sonner", () => ({ toast: { success: (m: string) => toastSuccess(m), error: vi.fn() } }));

describe("TruncatedText", () => {
  it("clamps to two lines by default", () => {
    render(<TruncatedText text="Some long project name" />);
    expect(screen.getByText("Some long project name")).toHaveClass("line-clamp-2");
  });

  it("copies the given value on click without bubbling to the row", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const onRowClick = vi.fn();
    render(
      <div onClick={onRowClick}>
        <TruncatedText text="Pretty name" copyValue="Raw_name" copyMessage="Project name copied" />
      </div>
    );
    fireEvent.click(screen.getByText("Pretty name"));
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Project name copied"));
    expect(writeText).toHaveBeenCalledWith("Raw_name");
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it("only mounts the tooltip once the text is hovered (lists render hundreds of these)", () => {
    render(<TruncatedText text="Hover me" />);
    const text = screen.getByText("Hover me");
    // Radix marks its trigger with data-state; a plain span has none
    expect(text).not.toHaveAttribute("data-state");

    fireEvent.pointerEnter(text);
    expect(screen.getByText("Hover me")).toHaveAttribute("data-state", "closed");
  });

  it("runs a custom click instead of copying", () => {
    const onClick = vi.fn();
    render(<TruncatedText text="Instructions" onClick={onClick} />);
    fireEvent.click(screen.getByText("Instructions"));
    expect(onClick).toHaveBeenCalled();
  });
});
