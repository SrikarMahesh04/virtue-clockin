"use client";
import { titleLabel } from "@/lib/labels";
import { Inbox, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { shortMonths } from "@/lib/time";

export function Empty({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Alert({
  text,
  success = false,
}: {
  text: string;
  success?: boolean;
}) {
  return (
    <div
      role={success ? "status" : "alert"}
      className={`alert ${success ? "success" : "error"}`}
    >
      {text}
    </div>
  );
}
export function Badge({ value }: { value: string }) {
  return <span className={`badge ${value}`}>{titleLabel(value)}</span>;
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
export function Drawer({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: React.ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    function keyboard(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === panel.current)
      ) {
        event.preventDefault();
        last.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = bodyOverflow;
      old?.focus();
    };
  }, [close]);
  return (
    <div className="drawer" onClick={close}>
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="drawer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row spread" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" aria-label="Close Panel" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function dateText(value: string | null, zone?: string) {
  if (!value) return "—";
  const instant = new Date(value);
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "numeric",
    year: "numeric",
    ...(zone ? { timeZone: zone } : {}),
  }).formatToParts(instant);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${part("day")}-${shortMonths[Number(part("month")) - 1]}-${part("year")}`;
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    ...(zone ? { timeZone: zone } : {}),
  }).format(instant);
  return `${date}, ${time}`;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function isoInput(value: string) {
  return new Date(value).toISOString();
}
