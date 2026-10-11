"use client";
import { CalendarDays } from "lucide-react";
import { useEffect, useRef, useState, type InputHTMLAttributes } from "react";
import { dateOnlyText, parseDate } from "@/lib/time";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "type"
> & {
  openOnClick?: boolean;
  value?: string;
  defaultValue?: string;
  onValueChange?: (iso: string) => void;
};

/** Explicit display format with ISO values retained for API/form submission. */
export function DateInput({
  value,
  openOnClick = false,
  defaultValue = "",
  onValueChange,
  name,
  ...props
}: Props) {
  const [iso, setIso] = useState(value ?? defaultValue);
  const [text, setText] = useState(
    value || defaultValue ? dateOnlyText(value ?? defaultValue) : "",
  );
  const [previous, setPrevious] = useState(value);
  if (value !== previous) {
    setPrevious(value);
    if (value !== undefined) {
      setIso(value);
      setText(value ? dateOnlyText(value) : "");
    }
  }
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== undefined) {
      input.current?.setCustomValidity("");
    }
  }, [value]);
  useEffect(() => {
    const form = root.current?.closest("form");
    const reset = () => {
      const next = value ?? defaultValue;
      setIso(next);
      setText(next ? dateOnlyText(next) : "");
      input.current?.setCustomValidity("");
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, value]);
  function select(next: string) {
    setIso(next);
    setText(next ? dateOnlyText(next) : "");
    input.current?.setCustomValidity("");
    onValueChange?.(next);
  }
  function openCalendar() {
    if (picker.current?.showPicker) picker.current.showPicker();
    else input.current?.focus();
  }
  return (
    <div className="date-input" ref={root}>
      <input
        {...props}
        ref={input}
        type="text"
        onClick={(e) => {
          if (openOnClick) openCalendar();
          props.onClick?.(e);
        }}
        placeholder="DD-Mmm-YYYY"
        title="Use DD-Mmm-YYYY, For Example 11-Oct-2026"
        value={text}
        onChange={(e) => {
          const raw = e.target.value;
          const next = parseDate(raw);
          setText(raw);
          setIso(next);
          e.target.setCustomValidity(
            raw && !next ? "Use DD-Mmm-YYYY, for example 11-Oct-2026" : "",
          );
          if (next || !raw) onValueChange?.(next);
        }}
        onBlur={(e) => {
          if (iso) setText(dateOnlyText(iso));
          props.onBlur?.(e);
        }}
      />
      {name && <input type="hidden" name={name} value={iso} />}
      <input
        ref={picker}
        className="native-date-picker"
        type="date"
        value={iso}
        aria-label="Native Calendar"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => select(e.target.value)}
      />
      <button
        type="button"
        className="date-picker-button"
        aria-label={`Choose ${props["aria-label"] || "date"}`}
        onClick={openCalendar}
      >
        <CalendarDays size={16} />
      </button>
    </div>
  );
}
