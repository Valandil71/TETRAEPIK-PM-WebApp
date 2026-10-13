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

  it("runs a custom click instead of copying", () => {
    const onClick = vi.fn();
    render(<TruncatedText text="Instructions" onClick={onClick} />);
    fireEvent.click(screen.getByText("Instructions"));
    expect(onClick).toHaveBeenCalled();
  });
});
