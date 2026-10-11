"use client";
import { RouteLink as Link } from "@/components/app-navigation";
import { Brand } from "@/components/brand";
import { titleLabel } from "@/lib/labels";
import { ServerClock } from "@/components/server-clock";
import { useAppNavigation } from "@/components/app-navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  Bell,
  CalendarDays,
  Clock3,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UserRound,
} from "lucide-react";
import {
  api,
  ApiError,
  message,
  Models,
  result,
  setCsrf,
} from "@/services/api";
import { Alert } from "@/components/ui";
import { SecretInput } from "@/components/secret-input";

import { adminPages, employeePages } from "@/services/navigation";

export const titles: Record<string, string> = {
  dashboard: "Dashboard",
  attendance: "Attendance",
  calendar: "Calendar",
  notifications: "Notifications",
  profile: "Profile & Security",
  employees: "Employee Management",
  shifts: "Shift Timings",
  settings: "System Settings",
};
const icons = {
  dashboard: LayoutDashboard,
  attendance: Clock3,
  calendar: CalendarDays,
  notifications: Bell,
  profile: UserRound,
  employees: Users,
  shifts: Clock3,
  settings: Settings,
};
type Context = {
  user: Models["UserView"];
  refresh: number;
  busy: boolean;
  act: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
};
const AppContext = createContext<Context | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing app context");
  return value;
}

export function useLoad<T>(loader: () => Promise<T>) {
  const { refresh } = useApp();
  const [state, setState] = useState<{
    data?: T;
    error?: ApiError;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(() => {
        if (!cancelled) setState({ loading: true });
        return loader();
      })
      .then((data) => {
        if (!cancelled) setState({ data, loading: false });
      })
      .catch((error) => {
        if (!cancelled)
          setState({
            error:
              error instanceof ApiError
                ? error
                : new ApiError("ERROR", message(error)),
            loading: false,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [loader, refresh]);
  return state;
}

export function LoadState({
  loading,
  error,
}: {
  loading: boolean;
  error?: ApiError;
}) {
  const [password, setPassword] = useState("");
  const { act, busy } = useApp();
  if (loading)
    return (
      <div className="card" role="status">
        Loading your records…
      </div>
    );
  if (!error) return null;
  return (
    <div className="stack">
      <Alert text={error.message} />
      <div className="row">
        <button
          disabled={busy}
          onClick={() => void act(async () => undefined, "")}
        >
          Retry
        </button>
        {error.status === 401 && <Link href="/login">Sign In Again</Link>}
      </div>
      {error.code === "REAUTH_REQUIRED" && (
        <form
          className="card form"
          onSubmit={(e) => {
            e.preventDefault();
            void act(
              () =>
                result(
                  api.POST("/api/v1/auth/reauthenticate", {
                    body: { password },
                  }),
                ),
              "Administrative access confirmed",
            );
          }}
        >
          <h2>Confirm Your Password</h2>
          <SecretInput
            label="Account Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button disabled={busy} className="primary">
            Continue
          </button>
        </form>
      )}
    </div>
  );
}

export function Shell({
  area,
  screen,
  children,
}: {
  area: "employee" | "admin";
  screen: string;
  children: React.ReactNode;
}) {
  const router = useAppNavigation();
  const [session, setSession] = useState<Models["SessionView"]>(),
    [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState("");
  useEffect(() => {
    let active = true;
    result(api.GET("/api/v1/auth/session"))
      .then((value) => {
        if (active) {
          if (area === "employee" && value.user.role !== "employee") {
            router.replace("/admin/dashboard");
            return;
          }
          setCsrf(value.csrf);
          setSession(value);
        }
      })
      .catch((error) => {
        if (active) {
          if (error instanceof ApiError && error.status === 401)
            router.replace("/login");
          else setError(message(error));
        }
      });
    return () => {
      active = false;
    };
  }, [router, area]);
  const act = useCallback(
    async (action: () => Promise<unknown>, success = "Saved") => {
      setBusy(true);
      setError("");
      setToast("");
      try {
        await action();
        setRefresh((v) => v + 1);
        setToast(success);
        return true;
      } catch (error) {
        setError(message(error));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [],
  );
  if (!session)
    return (
      <main className="auth-bg">
        <section className="card auth-card">
          <Brand />
          {error ? (
            <>
              <Alert text={error} />
              <p style={{ marginTop: 20 }}>
                Run database migrations and bootstrap your first administrator
                to get started.
              </p>
              <button onClick={() => window.location.reload()}>
                Retry Connection
              </button>
            </>
          ) : (
            <p role="status">Verifying your session…</p>
          )}
        </section>
      </main>
    );
  const user = session.user;
  if (area === "admin" && user.role === "employee")
    return (
      <main className="auth-bg">
        <section className="card">
          <h1>Access Denied</h1>
          <Link href="/employee/dashboard">Go To Your Dashboard</Link>
        </section>
      </main>
    );
  const pages = area === "admin" ? adminPages : employeePages;
  return (
    <AppContext.Provider value={{ user, refresh, busy, act }}>
      <a className="skip-link button" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <Brand href={`/${area}/dashboard`} />
          <div>
            <p className="nav-section">
              {area === "admin" ? "WORKFORCE MANAGEMENT" : "YOUR WORKSPACE"}
            </p>
            <nav aria-label="Main Navigation">
              {pages.map((page) => {
                const Icon = icons[page as keyof typeof icons];
                return (
                  <Link
                    key={page}
                    href={`/${area}/${page}`}
                    aria-current={screen === page ? "page" : undefined}
                    className={`nav-link ${screen === page ? "active" : ""}`}
                  >
                    <Icon />
                    {titles[page]}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <div>
          <header className="topbar">
            <span className="muted">
              {area === "admin"
                ? "Organization Workspace"
                : "Employee Workspace"}
            </span>
            <div className="row">
              <ServerClock />
              {area === "employee" && (
                <Link aria-label="Notifications" href="/employee/notifications">
                  <Bell size={19} />
                </Link>
              )}
              <span
                style={{ borderLeft: "1px solid #30424c", paddingLeft: 16 }}
              >
                {user.name}
              </span>
              <BadgeRole role={user.role} />
              <button
                className="mobile-logout"
                style={{ padding: 8 }}
                onClick={() =>
                  void act(async () => {
                    await result(api.POST("/api/v1/auth/logout"));
                    setCsrf("");
                    router.push("/login");
                  })
                }
                aria-label="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>
          <main
            id="main"
            className={`main-content ${screen === "calendar" ? "calendar-page" : ""}`}
          >
            <div className="page-heading">
              <p className="eyebrow">VIRTUE CLOCKIN / {area.toUpperCase()}</p>
              <h1>{titles[screen]}</h1>
              <p className="muted">
                {screen === "dashboard"
                  ? `Welcome back, ${user.name.split(" ")[0]}. ${area === "admin" ? "Here is employee attendance at a glance." : "Here is your workday at a glance."}`
                  : "Manage your records with a clear view of every update."}
              </p>
            </div>
            <div className="stack">
              {error && <Alert text={error} />}{" "}
              {toast && <Alert text={toast} success />}
              {children}
            </div>
          </main>
        </div>
      </div>
    </AppContext.Provider>
  );
}
function BadgeRole({ role }: { role: string }) {
  return <span className="badge">{titleLabel(role)}</span>;
}
