"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Field, dateText } from "@/components/ui";
import { Modal } from "@/components/modal";
import { api, Models, result, message } from "@/services/api";
import { dateOnlyText } from "@/lib/time";
import { useApp } from "./shell";

type Change = {
  at: string;
  reason: string;
  before: { punch_in: string | null; punch_out: string | null; status: string };
  after: { punch_in: string; punch_out: string; status: string };
};
function TimePartDropdown({
  name,
  label,
  initial,
  part,
}: {
  name: string;
  label: string;
  initial: string;
  part: "Hour" | "Minute";
}) {
  const [value, setValue] = useState(initial);
  const root = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node))
        root.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <div className="regularization-hour">
      <span>{part}</span>
      <input type="hidden" name={name} value={value} />
      <details
        ref={root}
        onKeyDown={(event) => {
          if (event.key === "Escape" && root.current?.open) {
            event.preventDefault();
            event.stopPropagation();
            if (root.current) root.current.open = false;
            root.current?.querySelector("summary")?.focus();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            event.currentTarget.open = false;
        }}
      >
        <summary aria-label={`${label} ${part}`}>
          {value || (part === "Hour" ? "HH" : "MM")}
          <span aria-hidden="true">⌄</span>
        </summary>
        <div
          className="regularization-hour-options"
          role="group"
          aria-label={`${label} ${part} Choices`}
        >
          {Array.from({ length: part === "Hour" ? 12 : 60 }, (_, i) =>
            String(i + (part === "Hour" ? 1 : 0)).padStart(2, "0"),
          ).map((hour) => (
            <button
              type="button"
              key={hour}
              aria-pressed={value === hour}
              onClick={(event) => {
                setValue(hour);
                event.currentTarget.closest("details")?.removeAttribute("open");
                event.currentTarget
                  .closest("details")
                  ?.querySelector("summary")
                  ?.focus();
              }}
            >
              {hour}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
function PunchTime({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  const [hour, minute] = value ? value.split(":").map(Number) : [];
  return (
    <fieldset className="regularization-time">
      <legend>{label}</legend>
      <div className="regularization-time-controls">
        <TimePartDropdown
          part="Hour"
          label={label}
          name={`${name}-hour`}
          initial={
            hour === undefined ? "" : String(hour % 12 || 12).padStart(2, "0")
          }
        />
        <span aria-hidden="true">:</span>
        <TimePartDropdown
          part="Minute"
          label={label}
          name={`${name}-minute`}
          initial={minute === undefined ? "" : String(minute).padStart(2, "0")}
        />
        <Field label="AM / PM">
          <select
            aria-label={`${label} AM or PM`}
            name={`${name}-period`}
            defaultValue={hour >= 12 ? "PM" : "AM"}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </Field>
      </div>
    </fieldset>
  );
}
function punchValue(form: FormData, name: string) {
  const hour =
    (Number(form.get(`${name}-hour`)) % 12) +
    (form.get(`${name}-period`) === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${String(form.get(`${name}-minute`)).padStart(2, "0")}`;
}

export function RegularizeAttendance({
  row,
  close,
}: {
  row: Models["AttendanceView"];
  close: () => void;
}) {
  const { act, busy } = useApp();
  const [error, setError] = useState("");
  const zone = String(row.snapshot.timezone);
  const offset = String(row.snapshot.start).match(/([+-]\d{2}:\d{2}|Z)$/)?.[1];
  const history = (
    Array.isArray(row.snapshot.regularizations)
      ? row.snapshot.regularizations
      : []
  ) as Change[];
  function clock(value: string | null) {
    return value
      ? new Intl.DateTimeFormat("en-GB", {
          timeZone: zone,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        }).format(new Date(value))
      : "";
  }
  return (
    <Modal
      title={`Regularize ${dateOnlyText(row.local_date)}`}
      close={close}
      busy={busy}
      className="regularization-modal"
    >
      <p>Enter the verified punch times in {zone}.</p>
      {error && <Alert text={error} />}
      <form
        className="form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setError("");
          if (
            !form.get("in-hour") ||
            !form.get("out-hour") ||
            !form.get("in-minute") ||
            !form.get("out-minute")
          ) {
            setError("Choose an hour and minute for both punch times.");
            return;
          }
          if (!offset) {
            setError("This record has no saved timezone offset.");
            return;
          }
          const saved = await act(async () => {
            try {
              await result(
                api.POST("/api/v1/admin/attendance/{day_id}/regularize", {
                  params: { path: { day_id: row.id } },
                  body: {
                    punch_in: `${row.local_date}T${punchValue(form, "in")}:00${offset}`,
                    punch_out: `${row.local_date}T${punchValue(form, "out")}:00${offset}`,
                    reason: String(form.get("reason")),
                    revision: history.length,
                    expected_punch_in: row.punch_in,
                    expected_punch_out: row.punch_out,
                  },
                }),
              );
            } catch (failure) {
              setError(message(failure));
              throw failure;
            }
          }, "Attendance Regularized");
          if (saved) close();
        }}
      >
        <PunchTime label="Punch In" name="in" value={clock(row.punch_in)} />
        <PunchTime label="Punch Out" name="out" value={clock(row.punch_out)} />
        <Field label="Reason (Optional)">
          <textarea name="reason" maxLength={1000} />
        </Field>
        <div className="regularization-actions">
          <button className="primary" disabled={busy}>
            Save Regularization
          </button>
          <button type="button" disabled={busy} onClick={close}>
            Cancel
          </button>
        </div>
      </form>
      {history.length > 0 && (
        <details>
          <summary>Previous Regularizations ({history.length})</summary>
          {history.map((change, index) => (
            <article key={index}>
              <p>
                {dateText(change.at, zone)}
                {change.reason ? ` - ${change.reason}` : ""}
              </p>
              <p>
                Punch In changed from {dateText(change.before.punch_in, zone)}{" "}
                to {dateText(change.after.punch_in, zone)}
              </p>
              <p>
                Punch Out changed from {dateText(change.before.punch_out, zone)}{" "}
                to {dateText(change.after.punch_out, zone)}
              </p>
              <p>
                Status changed from {change.before.status} to{" "}
                {change.after.status}
              </p>
            </article>
          ))}
        </details>
      )}
    </Modal>
  );
}
