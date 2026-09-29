import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilterDropdown } from "@/components/general/FilterDropdown";
import { getTodayInLisbon, PAST_DUE_DATE_OPTIONS } from "@/utils/filterHelpers";

afterEach(() => vi.useRealTimers());

describe("past due-date picker", () => {
  it.each([
    ["yesterday", "2026-09-28", true],
    ["today", "2026-09-29", true],
    ["tomorrow", "2026-09-30", false],
  ])("handles %s", (_label, date, accepted) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    const onSelect = vi.fn();
    const onCustomDateChange = vi.fn();

    render(
      <FilterDropdown
        label="Due Date"
        options={PAST_DUE_DATE_OPTIONS}
        selected={null}
        onSelect={onSelect}
        onCustomDateChange={onCustomDateChange}
        customDateMax={getTodayInLisbon()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Due Date" }));
    fireEvent.click(screen.getByRole("button", { name: "Custom date" }));
    const input = screen.getByLabelText("Custom due date") as HTMLInputElement;
    expect(input.max).toBe("2026-09-29");
    fireEvent.change(input, { target: { value: date } });

    if (accepted) {
      expect(onCustomDateChange).toHaveBeenCalledWith(date);
      expect(onSelect).toHaveBeenCalledWith("Custom date");
    } else {
      expect(onCustomDateChange).not.toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    }
  });

  it("shows the capped value when a saved date is in the future", () => {
    render(
      <FilterDropdown
        label="Due Date"
        options={PAST_DUE_DATE_OPTIONS}
        selected="Custom date"
        onSelect={vi.fn()}
        customDateValue="2026-09-30"
        customDateMax="2026-09-29"
      />
    );
    expect(screen.getByRole("button", { name: /Until 2026-09-29/ })).toBeInTheDocument();
  });
});
