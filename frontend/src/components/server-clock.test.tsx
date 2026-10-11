import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ServerClock } from "./server-clock";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/services/api", () => ({
  api: { GET: get },
  result: async (value: unknown) => await value,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  get.mockReset();
});

it("uses server time and monotonic elapsed time despite a changed device wall clock", async () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  let elapsed = 0;
  vi.spyOn(performance, "now").mockImplementation(() => elapsed);
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2036-01-01T23:59:00Z"));
  get.mockResolvedValue({ instant: "2026-10-11T08:00:00Z", timezone: "UTC" });
  render(<ServerClock />);
  await act(async () => {});
  expect(screen.getByLabelText("Office Time")).toHaveTextContent("08:00 AM");
  get.mockRejectedValue(new Error("Offline"));
  elapsed = 61_000;
  await act(async () => {
    vi.advanceTimersByTime(61_000);
  });
  expect(screen.getByLabelText("Office Time")).toHaveTextContent("08:01 AM");
  elapsed = 121_000;
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(screen.getByLabelText("Office Time")).toHaveTextContent(
    "Time unavailable",
  );
});

it("reports unavailable time instead of displaying the device clock on initial failure", async () => {
  get.mockRejectedValue(new Error("Offline"));
  render(<ServerClock />);
  await act(async () => {});
  expect(screen.getByLabelText("Office Time")).toHaveTextContent(
    "Time unavailable",
  );
});
