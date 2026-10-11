import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateInput } from "./date-input";
import { dateOnlyText, parseDate } from "@/lib/time";
import { dateText } from "./ui";

describe("Consistent dates", () => {
  it("formats dates and zone-aware timestamps without device locale preferences", () => {
    expect(dateOnlyText("2026-10-11")).toBe("11-Oct-2026");
    expect(dateText("2026-10-10T20:00:00Z", "Asia/Kolkata")).toBe(
      "11-Oct-2026, 1:30 AM",
    );
    expect(parseDate("29-Feb-2028")).toBe("2028-02-29");
    expect(parseDate("29-Feb-2026")).toBe("");
    expect(parseDate("31-Apr-2026")).toBe("");
  });
  it("opens an independent calendar from either date box or its button", () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, "showPicker", {
      value: showPicker,
      configurable: true,
    });
    const { container } = render(
      <>
        <DateInput aria-label="Start Date" openOnClick />
        <DateInput aria-label="End Date" openOnClick />
      </>,
    );
    fireEvent.click(screen.getByRole("textbox", { name: "Start Date" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose End Date" }));
    expect(showPicker).toHaveBeenCalledTimes(2);
    expect(showPicker.mock.contexts[0]).toBe(
      container.querySelectorAll('input[type="date"]')[0],
    );
    expect(showPicker.mock.contexts[1]).toBe(
      container.querySelectorAll('input[type="date"]')[1],
    );
    delete (HTMLInputElement.prototype as Partial<HTMLInputElement>).showPicker;
  });
  it("validates displayed dates and submits ISO dates, retaining reset behavior", () => {
    const { container } = render(
      <form>
        <DateInput
          aria-label="Date"
          name="date"
          defaultValue="2026-10-11"
          required
        />
      </form>,
    );
    const input = screen.getByRole("textbox", { name: /^Date$/ });
    expect(input).toHaveValue("11-Oct-2026");
    fireEvent.change(input, { target: { value: "31-Feb-2026" } });
    expect(input).toBeInvalid();
    fireEvent.change(input, { target: { value: "12-Nov-2026" } });
    expect(input).toBeValid();
    expect(new FormData(container.querySelector("form")!).get("date")).toBe(
      "2026-11-12",
    );
    fireEvent.reset(container.querySelector("form")!);
    expect(input).toHaveValue("11-Oct-2026");
  });
});
