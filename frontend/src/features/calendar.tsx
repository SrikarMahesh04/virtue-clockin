"use client";
import { DateInput } from "@/components/date-input";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { api, ApiError, Models, result } from "@/services/api";
import { Badge, dateText, Field, localDate } from "@/components/ui";
import { LoadState, useApp, useLoad } from "./shell";
import { dateOnlyText, durationText, timeText } from "@/lib/time";

export function Calendar({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<Models["ServerTime"]>();
  const [error, setError] = useState<ApiError>();
  const { refresh } = useApp();
  useEffect(() => {
    if (data) return;
    let cancelled = false;
    void result(api.GET("/api/v1/time", { cache: "no-store" }))
      .then((clock) => {
        if (!cancelled) setData(clock);
      })
      .catch((failure: ApiError) => {
        if (!cancelled) setError(failure);
      });
    return () => {
      cancelled = true;
    };
  }, [data, refresh]);
  if (!data) return <LoadState loading={!error} error={error} />;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: data.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(data.instant));
  const part = (type: string) =>
    parts.find((value) => value.type === type)!.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return <CalendarContent admin={admin} initialDate={today} />;
}

function CalendarContent({
  admin,
  initialDate,
}: {
  admin: boolean;
  initialDate: string;
}) {
  const [selected, setSelected] = useState(initialDate);
  const [dateSelected, setDateSelected] = useState(true);
  const [employeeId, setEmployeeId] = useState("");
  const current = new Date(selected + "T12:00:00");
  const loader = useCallback(async () => {
    const anchor = new Date(selected + "T12:00:00");
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const from = new Date(
      first.getFullYear(),
      first.getMonth(),
      1 - ((first.getDay() + 6) % 7),
    );
    const start = localDate(from);
    const end = localDate(
      new Date(from.getFullYear(), from.getMonth(), from.getDate() + 41),
    );
    if (admin) {
      const [days, employees] = await Promise.all([
        result(api.GET("/api/v1/calendar-days")),
        result(api.GET("/api/v1/employees")),
      ]);
      return {
        calendar: {
          days,
          assignments: [],
          shifts: [],
          attendance: [],
          weekly_off: [],
          timezone: "",
        } satisfies Models["CalendarData"],
        employees: employees.filter((e) => e.role === "employee" && e.active),
      };
    }
    return {
      calendar: await result(
        api.GET("/api/v1/me/calendar", { params: { query: { start, end } } }),
      ),
      employees: [] as Models["UserView"][],
    };
  }, [admin, selected]);
  const { data, loading, error } = useLoad(loader);
  const { act, busy, user } = useApp();
  const calendar = data?.calendar;
  const targetId = admin ? employeeId : user.id;
  function effective(date: string) {
    const entries = calendar?.days.filter((day) => day.date === date) || [];
    return (
      entries.find((day) => day.user_id === targetId) ||
      entries.find((day) => day.user_id === null)
    );
  }
  function move(step: number) {
    const date = new Date(current);
    date.setMonth(date.getMonth() + step, 1);
    setSelected(localDate(date));
    setDateSelected(false);
  }

  const first = new Date(current.getFullYear(), current.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - ((first.getDay() + 6) % 7));
  const dates = Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart);
    date.setDate(date.getDate() + i);
    return localDate(date);
  });
  const assignment = calendar?.assignments.find(
    (a) => a.valid_from <= selected && (!a.valid_to || a.valid_to >= selected),
  );
  const shift = calendar?.shifts.find((s) => s.id === assignment?.shift_id);
  const attendance = calendar?.attendance.find(
    (a) => a.local_date === selected,
  );
  const scopedEntry = calendar?.days.find(
    (day) => day.date === selected && day.user_id === (employeeId || null),
  );
  const selectedEntries =
    calendar?.days.filter(
      (day) =>
        day.date === selected &&
        (!employeeId || !day.user_id || day.user_id === employeeId),
    ) || [];
  const kindLabel = (kind: string) =>
    kind === "holiday"
      ? "Holiday"
      : kind === "optional_holiday"
        ? "Optional Holiday (Working Day)"
        : "Work From Home";
  const employeeLabel = (id: string | null | undefined) =>
    id
      ? data?.employees.find((employee) => employee.id === id)?.name ||
        "Inactive Employee"
      : "All Employees";
  return (
    <div className="calendar-layout">
      <section className="card calendar-options" aria-label="Calendar Options">
        <h2>{admin ? "Holiday or Work From Home" : "Selected Date"}</h2>
        {data ? (
          <>
            {admin ? (
              <>
                <form
                  key={selected + employeeId + String(scopedEntry?.id)}
                  className="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = new FormData(event.currentTarget);
                    const kind = String(form.get("kind")) as
                      "holiday" | "work_from_home" | "optional_holiday";
                    void act(
                      () =>
                        result(
                          api.POST("/api/v1/calendar-days", {
                            body: {
                              date: selected,
                              user_id: employeeId || null,
                              kind,
                              name:
                                String(form.get("name")).trim() ||
                                kindLabel(kind),
                            },
                          }),
                        ),
                      "Calendar updated",
                    );
                  }}
                >
                  <Field label="Date">
                    <DateInput
                      aria-label="Date"
                      openOnClick
                      value={selected}
                      onValueChange={(value) => {
                        if (value) {
                          setSelected(value);
                          setDateSelected(true);
                        }
                      }}
                      required
                    />
                  </Field>
                  <Field label="Employee">
                    <select
                      value={employeeId}
                      onChange={(event) => setEmployeeId(event.target.value)}
                    >
                      <option value="">All Employees</option>
                      {data.employees.map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Day Type">
                    <select
                      name="kind"
                      defaultValue={scopedEntry?.kind || "holiday"}
                    >
                      <option value="holiday">Holiday</option>
                      <option value="work_from_home">Work From Home</option>
                      <option value="optional_holiday">
                        Optional Holiday (Working Day)
                      </option>
                    </select>
                  </Field>
                  <Field label="Description (Optional)">
                    <input
                      name="name"
                      maxLength={160}
                      defaultValue={scopedEntry?.name || ""}
                    />
                  </Field>
                  <button className="primary" disabled={busy}>
                    Save Calendar Day
                  </button>
                  <small>
                    Individual entries take priority. Optional holidays are
                    working days; Work From Home is recorded without punches.
                  </small>
                </form>
                <div className="calendar-date-entries">
                  <h3>{dateOnlyText(selected)}</h3>
                  {selectedEntries.length ? (
                    selectedEntries.map((day) => (
                      <article key={day.id} className="calendar-entry">
                        <div>
                          <Badge value={day.kind} />
                          <p>{day.name}</p>
                          <small>{employeeLabel(day.user_id)}</small>
                        </div>
                        <button
                          disabled={busy}
                          aria-label={`Remove ${kindLabel(day.kind)} for ${employeeLabel(day.user_id)}`}
                          onClick={() =>
                            void act(
                              () =>
                                result(
                                  api.DELETE(
                                    "/api/v1/calendar-days/{entry_id}",
                                    { params: { path: { entry_id: day.id } } },
                                  ),
                                ),
                              "Calendar entry removed",
                            )
                          }
                        >
                          Remove
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className="muted">No calendar entry for this date.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3>{dateOnlyText(selected)}</h3>
                <p className="muted">
                  Office timezone: {calendar?.timezone || "—"}
                </p>
                {shift ? (
                  <p>
                    {shift.name} · {timeText(shift.starts_at)} –{" "}
                    {timeText(shift.ends_at)}
                    <br />
                    <small>
                      Expected Working Hours:{" "}
                      {durationText(shift.expected_working_minutes)}
                    </small>
                  </p>
                ) : (
                  <p className="muted">No shift assigned for this date.</p>
                )}
                <dl className="calendar-punches">
                  <div>
                    <dt>Punch In</dt>
                    <dd>
                      {attendance?.punch_in
                        ? dateText(attendance.punch_in, calendar?.timezone)
                        : "Not Punched In"}
                    </dd>
                  </div>
                  <div>
                    <dt>Punch Out</dt>
                    <dd>
                      {attendance?.punch_out
                        ? dateText(attendance.punch_out, calendar?.timezone)
                        : "Not Punched Out"}
                    </dd>
                  </div>
                </dl>
              </>
            )}
          </>
        ) : (
          <LoadState loading={loading} error={error} />
        )}
      </section>
      <section className="card calendar-panel" aria-label="Calendar">
        <div className="calendar-toolbar">
          <button aria-label="Previous Month" onClick={() => move(-1)}>
            <ChevronLeft size={16} />
          </button>
          <h2 aria-live="polite">
            {current.toLocaleDateString("en-GB", {
              ...(dateSelected ? { day: "2-digit" as const } : {}),
              month: "long",
              year: "numeric",
            })}
          </h2>
          <button aria-label="Next Month" onClick={() => move(1)}>
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="calendar-legend" aria-label="Calendar Legend">
          {!admin && (
            <span>
              <i className="calendar-dot attendance" />
              Punch Recorded
            </span>
          )}
          <span>
            <i className="calendar-dot holiday" />
            Holiday
          </span>
          <span>
            <i className="calendar-dot optional_holiday" />
            Optional · working day
          </span>
          <span>
            <i className="calendar-dot work_from_home" />
            Work From Home
          </span>
        </div>
        {data ? (
          <>
            {
              <div className="calendar-grid">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <small key={day} style={{ padding: 8 }}>
                      {day}
                    </small>
                  ),
                )}
              </div>
            }
            <div className="calendar-grid">
              {dates.map((date) => {
                const day = effective(date);
                const record = calendar?.attendance.find(
                  (row) => row.local_date === date,
                );
                const individualCount =
                  admin && !employeeId
                    ? calendar?.days.filter(
                        (item) => item.date === date && item.user_id,
                      ).length || 0
                    : 0;
                const details = [
                  day,
                  ...(admin && !employeeId
                    ? calendar?.days.filter(
                        (item) => item.date === date && item.user_id,
                      ) || []
                    : []),
                ].filter((item): item is Models["CalendarView"] =>
                  Boolean(item),
                );
                const tooltip = details
                  .map(
                    (item) =>
                      `${item.name} · ${kindLabel(item.kind)} · All day · Office calendar${admin ? ` · ${employeeLabel(item.user_id)}` : ""}`,
                  )
                  .join("\n");
                return (
                  <button
                    key={date}
                    aria-label={`Select ${dateOnlyText(date)}`}
                    aria-pressed={selected === date}
                    aria-describedby={
                      tooltip ? `calendar-details-${date}` : undefined
                    }
                    onClick={() => {
                      setSelected(date);
                      setDateSelected(true);
                    }}
                    className={`calendar-cell ${selected === date ? "selected" : ""} ${date.slice(0, 7) !== selected.slice(0, 7) ? "outside" : ""}`}
                  >
                    <span>{Number(date.slice(-2))}</span>
                    <span className="calendar-dots" aria-hidden="true">
                      {details.map((item) => (
                        <span
                          key={item.id}
                          className={`calendar-dot ${item.kind}`}
                        />
                      ))}
                      {record?.punch_in && !day && (
                        <span className="calendar-dot attendance" />
                      )}
                    </span>
                    {day && (
                      <span className="sr-only">{kindLabel(day.kind)}</span>
                    )}
                    {individualCount > 0 && (
                      <span className="sr-only">
                        {individualCount} employee entries
                      </span>
                    )}
                    {tooltip && (
                      <span
                        role="tooltip"
                        id={`calendar-details-${date}`}
                        className="calendar-tooltip"
                      >
                        {tooltip}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <LoadState loading={loading} error={error} />
        )}
      </section>
    </div>
  );
}
