import {
  render as renderComponent,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppNavigation } from "@/components/app-navigation";
import { AuthForm } from "./auth";
import { passwordStrength } from "./password-strength";

function render(ui: React.ReactNode) {
  return renderComponent(<AppNavigation>{ui}</AppNavigation>);
}

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
beforeEach(() => {
  window.history.replaceState(
    null,
    "",
    "/activate#token=private-test-link-token",
  );
});

describe("Credential entry", () => {
  it("starts PIN login empty and avoids saved-password autofill hints", () => {
    render(<AuthForm mode="pin" />);
    const pin = screen.getByLabelText("Your Six-Digit PIN", { exact: true });
    expect(pin).toHaveValue("");
    expect(
      screen
        .getByRole("button", { name: "Show your six-digit pin" })
        .querySelector("svg"),
    ).toHaveClass("lucide-eye-off");
    expect(pin).toHaveAttribute("autocomplete", "off");
    expect(pin).toHaveAttribute("name", "clockin_login_pin");
    fireEvent.change(pin, { target: { value: "saved-password" } });
    expect(pin).toHaveValue("");
    fireEvent.change(pin, { target: { value: "001234" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show your six-digit pin",
      }),
    );
    expect(pin).toHaveAttribute("type", "text");
    expect(
      screen
        .getByRole("button", { name: "Hide your six-digit pin" })
        .querySelector("svg"),
    ).toHaveClass("lucide-eye");
    expect(pin).toHaveValue("001234");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Hide your six-digit pin",
      }),
    );
    expect(pin).toHaveAttribute("type", "password");
    expect(pin).toHaveValue("001234");
  });

  it.each(["activate", "reset"] as const)(
    "toggles credentials independently without submitting %s",
    async (mode) => {
      render(<AuthForm mode={mode} />);
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save Password and PIN" }),
        ).toBeEnabled(),
      );
      expect(
        screen.queryByLabelText(/recovery token/i),
      ).not.toBeInTheDocument();
      expect(window.location.hash).toBe("");
      const password = screen.getByLabelText("Password", { exact: true });
      const confirm = screen.getByLabelText("Confirm Password", {
        exact: true,
      });
      const pin = screen.getByLabelText("Choose Your Six-Digit PIN", {
        exact: true,
      });
      fireEvent.change(password, { target: { value: "chosen-password" } });
      const show = screen.getByRole("button", {
        name: "Show password",
      });
      expect(show).toHaveAttribute("type", "button");
      fireEvent.click(show);
      expect(password).toHaveAttribute("type", "text");
      expect(password).toHaveValue("chosen-password");
      expect(confirm).toHaveAttribute("type", "password");
      expect(pin).toHaveAttribute("type", "password");
      expect(
        screen.getByRole("button", { name: "Hide password" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );
  it.each(["activate", "reset"] as const)(
    "explains a missing link and blocks submission in %s",
    async (mode) => {
      window.history.replaceState(null, "", "/" + mode);
      render(<AuthForm mode={mode} />);
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Open the complete activation or recovery link",
      );
      expect(
        screen.getByRole("button", { name: "Save Password and PIN" }),
      ).toBeDisabled();
      expect(
        screen.queryByLabelText(/recovery token/i),
      ).not.toBeInTheDocument();
    },
  );
});

describe("Advisory password strength", () => {
  it.each([
    ["a", "Weak"],
    ["password123", "Weak"],
    ["a".repeat(24), "Weak"],
    ["abcdefghij", "Medium"],
    ["ClockIn!2026secure", "Strong"],
  ])("rates %s as %s", (password, strength) => {
    expect(passwordStrength(password)).toBe(strength);
  });
  it.each(["activate", "reset"] as const)(
    "allows short passwords in %s",
    async (mode) => {
      render(<AuthForm mode={mode} />);
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Save Password and PIN" }),
        ).toBeEnabled(),
      );
      const password = screen.getByLabelText("Password", { exact: true });
      const confirm = screen.getByLabelText("Confirm Password", {
        exact: true,
      });
      expect(password).not.toHaveAttribute("minlength");
      expect(confirm).not.toHaveAttribute("minlength");
      fireEvent.change(password, { target: { value: "a" } });
      fireEvent.change(confirm, { target: { value: "a" } });
      expect((password as HTMLInputElement).checkValidity()).toBe(true);
      expect(screen.getByRole("status")).toHaveTextContent(
        "Password strength: Weak",
      );
      expect(
        screen.getByRole("button", { name: "Save Password and PIN" }),
      ).toBeEnabled();
      fireEvent.change(password, { target: { value: "abcdefghij" } });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Password strength: Medium",
      );
      fireEvent.change(password, { target: { value: "ClockIn!2026secure" } });
      expect(screen.getByRole("status")).toHaveTextContent(
        "Password strength: Strong",
      );
    },
  );
});
