import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { AppNavigation, useAppNavigation } from "./app-navigation";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function Controls() {
  const navigation = useAppNavigation();
  const [count, setCount] = useState(0);
  return (
    <>
      <button onClick={() => navigation.push("/employee/calendar")}>
        Navigate
      </button>
      <button onClick={() => navigation.push("/login/pin")}>Use PIN</button>
      <button onClick={() => navigation.push("/login")}>Use Password</button>
      <button onClick={() => navigation.replace("/forgot-password")}>
        Redirect
      </button>
      <button onClick={() => navigation.push("/login#form")}>Same Page</button>
      <button onClick={() => setCount(count + 1)}>Edit {count}</button>
    </>
  );
}

describe("Page navigation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.history.replaceState(null, "", "/login");
  });
  afterEach(() => vi.useRealTimers());
  it("shows an accessible overlay and waits one second before pushing a route", async () => {
    render(
      <AppNavigation>
        <Controls />
      </AppNavigation>,
    );
    fireEvent.click(screen.getByText("Navigate"));
    expect(screen.getByRole("status")).toHaveTextContent("Loading Page");
    expect(screen.getByText("Navigate").closest("[inert]")).not.toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(999));
    expect(router.push).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(router.push).toHaveBeenCalledExactlyOnceWith("/employee/calendar");
  });
  it("delays redirects and ignores repeated navigation while waiting", async () => {
    render(
      <AppNavigation>
        <Controls />
      </AppNavigation>,
    );
    fireEvent.click(screen.getByText("Redirect"));
    fireEvent.click(screen.getByText("Navigate"));
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(router.replace).toHaveBeenCalledExactlyOnceWith("/forgot-password");
    expect(router.push).not.toHaveBeenCalled();
  });
  it("does not animate internal actions or same-page destinations", () => {
    render(
      <AppNavigation>
        <Controls />
      </AppNavigation>,
    );
    fireEvent.click(screen.getByText("Edit 0"));
    expect(screen.getByText("Edit 1")).toBeVisible();
    fireEvent.click(screen.getByText("Same Page"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });
  it("cancels delayed navigation when the provider unmounts", async () => {
    const view = render(
      <AppNavigation>
        <Controls />
      </AppNavigation>,
    );
    fireEvent.click(screen.getByText("Navigate"));
    view.unmount();
    await act(() => vi.advanceTimersByTimeAsync(1000));
    expect(router.push).not.toHaveBeenCalled();
  });
  it.each([
    ["/login", "Use PIN", "/login/pin"],
    ["/login/pin", "Use Password", "/login"],
  ])(
    "switches sign-in methods immediately from %s without an overlay",
    (from, label, to) => {
      window.history.replaceState(null, "", from);
      render(
        <AppNavigation>
          <Controls />
        </AppNavigation>,
      );
      fireEvent.click(screen.getByText(label));
      expect(router.push).toHaveBeenCalledExactlyOnceWith(to);
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(vi.getTimerCount()).toBe(0);
    },
  );
});
