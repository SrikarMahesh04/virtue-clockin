import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShiftTimeFields } from "./shift-time-fields";
import { durationText, timeText } from "@/lib/time";
import { dateText } from "./ui";

function Form() {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <form>
      <ShiftTimeFields
        start={start}
        end={end}
        onStart={setStart}
        onEnd={setEnd}
      />
    </form>
  );
}

describe("Shift timings", () => {
  it("shows worked and expected durations in hours and minutes", () => {
    expect(durationText(456)).toBe("7h 36min");
    expect(durationText(540)).toBe("9h 0min");
    expect(durationText(0)).toBe("0h 0min");
    expect(durationText(59)).toBe("0h 59min");
  });
  it("uses AM/PM choices with machine-readable form values and no timezone controls", () => {
    const { container } = render(<Form />);
    fireEvent.click(screen.getByRole("combobox", { name: "Start Time" }));
    expect(screen.getAllByRole("option")).toHaveLength(48);
    fireEvent.click(screen.getByRole("option", { name: "12:30 PM" }));
    fireEvent.click(screen.getByRole("combobox", { name: "End Time" }));
    fireEvent.click(screen.getByRole("option", { name: "1:00 PM" }));
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("start")).toBe("12:30");
    expect(data.get("end")).toBe("13:00");
    expect(container.textContent).not.toMatch(/UTC|Kolkata|time zone|lunch/i);
  });
  it("supports arrow navigation, selection and Escape", () => {
    render(<Form />);
    const start = screen.getByRole("combobox", { name: "Start Time" });
    fireEvent.keyDown(start, { key: "ArrowDown" });
    fireEvent.keyDown(start, { key: "ArrowDown" });
    fireEvent.keyDown(start, { key: "Enter" });
    expect(start).toHaveTextContent("12:30 AM");
    fireEvent.click(start);
    fireEvent.keyDown(start, { key: "Escape" });
    expect(start).toHaveAttribute("aria-expanded", "false");
  });
  it("formats midnight/noon and timestamps in AM/PM", () => {
    expect(timeText("00:00:00")).toBe("12:00 AM");
    expect(timeText("12:00")).toBe("12:00 PM");
    expect(dateText("2026-10-10T17:00:00Z", "UTC")).toContain("5:00 PM");
  });
});
