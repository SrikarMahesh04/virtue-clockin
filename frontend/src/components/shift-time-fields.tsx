"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { timeText } from "@/lib/time";

export const shiftTimes = Array.from(
  { length: 48 },
  (_, index) =>
    `${String(Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
);

export function TimeDropdown({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 266,
  });
  const options = [
    ...new Set([...shiftTimes, ...(value ? [value] : [])]),
  ].sort();
  const [highlight, setHighlight] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const list = root.current?.querySelector<HTMLElement>('[role="listbox"]');
    const option = list?.querySelector<HTMLElement>(
      `[data-index="${highlight}"]`,
    );
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (
      option.offsetTop + option.offsetHeight >
      list.scrollTop + list.clientHeight
    )
      list.scrollTop =
        option.offsetTop + option.offsetHeight - list.clientHeight;
  }, [highlight, open]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (!open) return;
    const closeOnMove = (event: Event) => {
      const list = root.current?.querySelector('[role="listbox"]');
      if (event.type === "scroll" && list?.contains(event.target as Node))
        return;
      setOpen(false);
    };
    window.addEventListener("resize", closeOnMove);
    document.addEventListener("scroll", closeOnMove, true);
    return () => {
      window.removeEventListener("resize", closeOnMove);
      document.removeEventListener("scroll", closeOnMove, true);
    };
  }, [open]);
  function choose(index: number) {
    onChange(options[index]);
    setOpen(false);
    button.current?.focus();
  }
  function show() {
    const bounds = button.current?.getBoundingClientRect();
    if (!bounds) return;
    const below = window.innerHeight - bounds.bottom - 8;
    const above = bounds.top - 8;
    const opensAbove = below < 266 && above > below;
    const maxHeight = Math.min(266, opensAbove ? above : below);
    setMenuStyle({
      top: opensAbove ? bounds.top - maxHeight : bounds.bottom,
      left: bounds.left,
      width: bounds.width,
      maxHeight,
    });
    setHighlight(Math.max(0, options.indexOf(value)));
    setOpen(true);
  }
  return (
    <div className="time-picker" ref={root}>
      <label id={`${id}-label`} htmlFor={`${id}-trigger`}>
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        ref={button}
        id={`${id}-trigger`}
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-haspopup="listbox"
        aria-required="true"
        aria-activedescendant={open ? `${id}-${highlight}` : undefined}
        className="time-trigger"
        onClick={() => {
          if (open) setOpen(false);
          else show();
        }}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget))
            setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Tab") {
            if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
            }
            setOpen(false);
            return;
          }
          if (
            ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(
              e.key,
            )
          ) {
            e.preventDefault();
            if (!open) {
              show();
              return;
            }
            if (e.key === "Enter" || e.key === " ") choose(highlight);
            else
              setHighlight(
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? options.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          options.length - 1,
                          highlight + (e.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
              );
          }
        }}
      >
        {value ? timeText(value) : "Select Time"}
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          className="time-options"
          style={menuStyle}
        >
          {options.map((option, index) => (
            <div
              role="option"
              id={`${id}-${index}`}
              key={option}
              data-index={index}
              aria-selected={value === option}
              className={highlight === index ? "highlighted" : ""}
              onPointerDown={(e) => e.preventDefault()}
              onMouseMove={() => setHighlight(index)}
              onClick={() => choose(index)}
            >
              {timeText(option)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ShiftTimeFields({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string;
  end: string;
  onStart: (value: string) => void;
  onEnd: (value: string) => void;
}) {
  return (
    <div className="shift-time-grid">
      <TimeDropdown
        label="Start Time"
        name="start"
        value={start}
        onChange={onStart}
      />
      <TimeDropdown label="End Time" name="end" value={end} onChange={onEnd} />
    </div>
  );
}
