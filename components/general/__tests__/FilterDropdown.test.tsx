import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { getTodayInLisbon, PAST_DUE_DATE_OPTIONS } from "@/utils/filterHelpers";

afterEach(() => vi.useRealTimers());

function setup(props: Partial<React.ComponentProps<typeof FilterDropdown>> = {}) {
  const onSelect = vi.fn();
  const onCustomDateChange = vi.fn();
  render(
    <FilterDropdown
      label="Due Date"
      options={PAST_DUE_DATE_OPTIONS}
      selected={null}
      onSelect={onSelect}
      onCustomDateChange={onCustomDateChange}
      {...props}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Due Date" }));
  fireEvent.click(screen.getByRole("button", { name: "Custom date" }));
  return { onSelect, onCustomDateChange };
}

describe("custom due-date modal", () => {
  it("opens a dialog and applies the date only on confirm", () => {
    const { onSelect, onCustomDateChange } = setup();
    const input = screen.getByLabelText("Until") as HTMLInputElement;
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.change(input, { target: { value: "2026-09-28" } });
    expect(onCustomDateChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onCustomDateChange).toHaveBeenCalledWith("2026-09-28");
    expect(onSelect).toHaveBeenCalledWith("Custom date");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Cancel and Esc close without changing the filter", () => {
    const { onSelect, onCustomDateChange } = setup();
    fireEvent.change(screen.getByLabelText("Until"), {
      target: { value: "2026-09-28" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Due Date" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom date" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onCustomDateChange).not.toHaveBeenCalled();
  });

  it.each([
    ["yesterday", "2026-09-28", true],
    ["today", "2026-09-29", true],
    ["tomorrow", "2026-09-30", false],
  ])("with a max of today, %s is %s", (_l, date, accepted) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    const { onCustomDateChange } = setup({ customDateMax: getTodayInLisbon() });
    const input = screen.getByLabelText("Until") as HTMLInputElement;
    expect(input.max).toBe("2026-09-29");
    fireEvent.change(input, { target: { value: date } });
    const apply = screen.getByRole("button", { name: "Apply" });
    if (accepted) {
      fireEvent.click(apply);
      expect(onCustomDateChange).toHaveBeenCalledWith(date);
    } else {
      expect(apply).toBeDisabled();
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(onCustomDateChange).not.toHaveBeenCalled();
    }
  });

  it("shows the capped value when a saved date is in the future", () => {
    render(
      <FilterDropdown
        label="Due Date"
        options={PAST_DUE_DATE_OPTIONS}
        selected="Custom date"
        onSelect={vi.fn()}
        onCustomDateChange={vi.fn()}
        customDateValue="2026-09-30"
        customDateMax="2026-09-29"
      />
    );
    expect(screen.getByRole("button", { name: /Until 2026-09-29/ })).toBeInTheDocument();
  });
});
