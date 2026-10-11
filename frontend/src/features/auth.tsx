"use client";
import { RouteLink as Link } from "@/components/app-navigation";
import { Brand } from "@/components/brand";
import { titleLabel } from "@/lib/labels";
import { useAppNavigation, useLoginEmail } from "@/components/app-navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, KeyRound, ShieldCheck } from "lucide-react";
import { api, message, result, setCsrf } from "@/services/api";
import { Alert, Field } from "@/components/ui";
import { SecretInput } from "@/components/secret-input";
import { passwordStrength } from "./password-strength";

export function AuthForm({
  mode,
}: {
  mode: "password" | "pin" | "forgot" | "reset" | "activate";
}) {
  const router = useAppNavigation();
  const { email, setEmail } = useLoginEmail();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [token, setToken] = useState("");
  const [linkChecked, setLinkChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  useEffect(() => {
    if (mode === "reset" || mode === "activate") {
      const token =
        new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
      queueMicrotask(() => {
        if (token) setToken(token);
        setLinkChecked(true);
      });
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [mode]);
  const signing = mode === "password" || mode === "pin";
  const title = {
    password: "Welcome to ClockIn",
    pin: "Sign in with your PIN",
    forgot: "Reset your password",
    reset: "Set new credentials",
    activate: "Set up your account",
  }[mode];
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (signing) {
        const session = await result(
          api.POST("/api/v1/auth/login", {
            body: {
              email: String(form.get("email")),
              method: mode,
              secret: String(
                form.get(mode === "pin" ? "clockin_login_pin" : "secret"),
              ),
            },
          }),
        );
        setCsrf(session.csrf);
        setEmail("");
        router.push(
          session.user.role === "employee"
            ? "/employee/dashboard"
            : "/admin/dashboard",
        );
      } else if (mode === "forgot") {
        const value = await result(
          api.POST("/api/v1/auth/recovery/request", {
            body: { email: String(form.get("email")) },
          }),
        );
        setSuccess(value.message);
      } else {
        if (!token)
          throw new Error(
            "Open the complete account link to continue, or request a new link.",
          );
        if (form.get("password") !== form.get("confirm"))
          throw new Error("Passwords do not match.");
        const body = {
          token,
          password: String(form.get("password")),
          pin: String(form.get("pin")),
        };
        const value =
          mode === "activate"
            ? await result(api.POST("/api/v1/auth/activate", { body }))
            : await result(
                api.POST("/api/v1/auth/recovery/complete", { body }),
              );
        setSuccess(value.message);
      }
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`auth-bg ${signing ? "login-page" : ""}`}>
      <section className="card auth-card">
        <Brand />
        <div
          className="auth-symbol"
          style={{ textAlign: "center", color: "#20e0db", marginBottom: 18 }}
        >
          {mode === "pin" ? (
            <KeyRound size={28} style={{ margin: "auto" }} />
          ) : (
            <ShieldCheck size={28} style={{ margin: "auto" }} />
          )}
        </div>
        <h1>{titleLabel(title)}</h1>
        <p className="intro">
          {signing
            ? "Your workday, clearly recorded."
            : "Use your company account to continue."}
        </p>
        <form
          key={mode}
          className="form"
          onSubmit={submit}
          autoComplete={mode === "pin" ? "off" : "on"}
        >
          {error && <Alert text={error} />}{" "}
          {success && <Alert text={success} success />}
          {(mode === "reset" || mode === "activate") &&
            linkChecked &&
            !token && (
              <Alert text="This page needs your account link. Open the complete activation or recovery link, or request a new one." />
            )}
          {(signing || mode === "forgot") && (
            <Field label="Company Email Address">
              <input
                name="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="username"
                required
                maxLength={254}
              />
            </Field>
          )}
          {signing && (
            <SecretInput
              label={mode === "pin" ? "Your Six-Digit PIN" : "Password"}
              className={mode === "pin" ? "pin-input" : ""}
              name={mode === "pin" ? "clockin_login_pin" : "secret"}
              autoComplete={mode === "pin" ? "off" : "current-password"}
              required
              {...(mode === "pin"
                ? {
                    inputMode: "numeric" as const,
                    value: pin,
                    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                      if (/^[0-9]{0,6}$/.test(event.target.value))
                        setPin(event.target.value);
                    },
                    "data-1p-ignore": true,
                    "data-lpignore": "true",
                    "data-bwignore": "true",
                    pattern: "[0-9]{6}",
                    minLength: 6,
                    maxLength: 6,
                  }
                : { maxLength: 256 })}
            />
          )}
          {(mode === "reset" || mode === "activate") && (
            <>
              <SecretInput
                label="Password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-describedby="password-strength"
                maxLength={256}
                required
              />
              <small id="password-strength" role="status" aria-live="polite">
                {password
                  ? `Password strength: ${passwordStrength(password)}. Strength is advisory.`
                  : "Password strength will appear as you type."}
              </small>
              <SecretInput
                label="Confirm Password"
                name="confirm"
                autoComplete="new-password"
                maxLength={256}
                required
              />
              <SecretInput
                label="Choose Your Six-Digit PIN"
                name="pin"
                data-1p-ignore
                data-lpignore="true"
                data-bwignore="true"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
              />
              <small>
                Your PIN is chosen by you. Use a strong password for sensitive
                actions.
              </small>
            </>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              Boolean(success && !signing) ||
              ((mode === "reset" || mode === "activate") && !token)
            }
          >
            {busy
              ? "Please wait…"
              : signing
                ? "Sign In"
                : mode === "forgot"
                  ? "Request Recovery Instructions"
                  : "Save Password and PIN"}
          </button>
          {mode === "pin" && (
            <small>
              Five incorrect PIN attempts lock PIN login for 15 minutes.
              Password login remains available.
            </small>
          )}
        </form>
        <div className="row spread auth-links">
          {mode === "password" ? (
            <>
              <Link href="/forgot-password">Forgot Password?</Link>
              <Link href="/login/pin">Use PIN</Link>
            </>
          ) : (
            <Link href="/login" className="row">
              <ArrowLeft size={16} />
              Back To Password Sign In
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
