import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Alert, Empty, Drawer, Badge } from "./ui";

describe("Truthful and accessible UI states", () => {
  it("announces errors distinctly from empty data", () => {
    const { rerender } = render(<Alert text="API unavailable" />);
    expect(screen.getByRole("alert")).toHaveTextContent("API unavailable");
    rerender(
      <Empty title="No Attendance Records">
        Punch in to start your record.
      </Empty>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("No Attendance Records")).toBeVisible();
    expect(screen.queryByText("0 hours")).not.toBeInTheDocument();
  });
  it("announces successful actions", () => {
    render(<Alert text="Punch In recorded" success />);
    expect(screen.getByRole("status")).toHaveTextContent("Punch In recorded");
  });
  it("uses text alongside semantic status colors", () => {
    render(<Badge value="leave_conflict" />);
    expect(screen.getByText("Leave Conflict")).toBeVisible();
  });
  it("supports modal focus, Escape and cleanup", () => {
    const close = vi.fn();
    const { unmount } = render(
      <Drawer title="Edit Employee" close={close}>
        <input aria-label="Name" />
      </Drawer>,
    );
    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
