"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ComponentProps,
  type ReactNode,
} from "react";

type Navigation = {
  push: (href: string) => void;
  replace: (href: string) => void;
};
const NavigationContext = createContext<Navigation | null>(null);
const LoginEmailContext = createContext<{
  email: string;
  setEmail: (value: string) => void;
} | null>(null);

export function isLoginMethodSwitch(from: string, to: string) {
  return (
    (from === "/login" && to === "/login/pin") ||
    (from === "/login/pin" && to === "/login")
  );
}

export function AppNavigation({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [email, setEmail] = useState("");
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const navigate = useCallback(
    (href: string, replace = false) => {
      const destination = new URL(href, window.location.href);
      // Page transitions only: same-page anchors and external links stay native.
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === window.location.pathname) return;
      if (timer.current) return;
      if (isLoginMethodSwitch(window.location.pathname, destination.pathname)) {
        if (replace) router.replace(href);
        else router.push(href);
        return;
      }
      setWaiting(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setWaiting(false);
        startTransition(() => {
          if (replace) router.replace(href);
          else router.push(href);
        });
      }, 1000);
    },
    [router],
  );
  const navigation = useMemo(
    () => ({
      push: (href: string) => navigate(href),
      replace: (href: string) => navigate(href, true),
    }),
    [navigate],
  );
  const loginEmail = useMemo(() => ({ email, setEmail }), [email]);
  const loading = waiting || pending;
  return (
    <NavigationContext.Provider value={navigation}>
      <LoginEmailContext.Provider value={loginEmail}>
        <div inert={loading} aria-busy={loading}>
          {children}
        </div>
        {loading && (
          <div className="route-loading" role="status" aria-live="polite">
            <div className="route-loading-card">
              <span className="route-spinner" aria-hidden="true" />
              <span>Loading Page…</span>
            </div>
          </div>
        )}
      </LoginEmailContext.Provider>
    </NavigationContext.Provider>
  );
}

export function useAppNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("Missing application navigation provider");
  return context;
}

export function useLoginEmail() {
  const context = useContext(LoginEmailContext);
  if (!context) throw new Error("Missing login email provider");
  return context;
}

export function RouteLink({
  href,
  ...props
}: Omit<ComponentProps<typeof NextLink>, "href" | "onNavigate"> & {
  href: string;
}) {
  const navigation = useAppNavigation();
  return (
    <NextLink
      {...props}
      href={href}
      onNavigate={(event) => {
        const destination = new URL(href, window.location.href);
        if (destination.pathname === window.location.pathname) return;
        event.preventDefault();
        if (props.replace) navigation.replace(href);
        else navigation.push(href);
      }}
    />
  );
}
