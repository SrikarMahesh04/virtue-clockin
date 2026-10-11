"use client";
import {
  RecordPagination,
  useRecordPageSize,
} from "@/components/record-pagination";
import { ServerClock } from "@/components/server-clock";
import { DateInput } from "@/components/date-input";
import { RouteLink as Link } from "@/components/app-navigation";
import { titleLabel } from "@/lib/labels";
import { useCallback, useState } from "react";
import {
  CalendarDays,
  Clock3,
  LogIn,
  LogOut,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { api, Models, result } from "@/services/api";
import { Badge, dateText, Empty, Field } from "@/components/ui";
import { LoadState, useApp, useLoad } from "./shell";
import { dateOnlyText, durationText, timeText } from "@/lib/time";

export function AttendanceTable({
  rows,
  employees = [],
}: {
  rows: Models["AttendanceView"][];
  employees?: Models["UserView"][];
}) {
  if (!rows.length)
    return (
      <Empty title="No Attendance Records">
        Records appear after a verified punch or a calendar entry.
      </Empty>
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Date</th>
            {employees.length > 0 && <th>Employee</th>}
            <th>Punch In</th>
            <th>Punch Out</th>
            <th>Net Hours</th>
            <th>Expected Hours</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                {dateOnlyText(row.local_date)}
                {row.snapshot.derived === true && (
                  <>
                    <br />
                    <small>Schedule-Derived</small>
                  </>
                )}
              </td>
              {employees.length > 0 && (
                <td>
                  {employees.find((e) => e.id === row.user_id)?.name ||
                    row.user_id}
                </td>
              )}
              <td>{dateText(row.punch_in, String(row.snapshot.timezone))}</td>
              <td>{dateText(row.punch_out, String(row.snapshot.timezone))}</td>
              <td>
                {row.status === "work_from_home" && !row.punch_in
                  ? "—"
                  : durationText(row.net_minutes)}
              </td>
              <td>{durationText(row.expected_minutes)}</td>
              <td>
                <Badge value={row.status} />
                {row.corrected && <small> · Corrected</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Stat({
  label,
  value,
  icon: Icon = Clock3,
}: {
  label: string;
  value: React.ReactNode;
  icon?: typeof Clock3;
}) {
  return (
    <div className="card">
      <Icon className="stat-icon" size={23} />
      <p className="stat-value">{value}</p>
      <small>{label}</small>
    </div>
  );
}

export function EmployeeDashboard() {
  const loader = useCallback(() => result(api.GET("/api/v1/me/dashboard")), []);
  const { data, loading, error } = useLoad(loader);
  const { act, busy } = useApp();
  async function punch(kind: "in" | "out") {
    await act(async () => {
      if (!window.isSecureContext)
        throw new Error(
          "Location verification requires HTTPS. Open the app using a secure address trusted by this device, then allow location access.",
        );
      if (!navigator.geolocation)
        throw new Error("This browser does not support location verification.");
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) =>
          navigator.geolocation.getCurrentPosition(
            resolve,
            () =>
              reject(
                new Error(
                  "Location access failed. Allow location access and try again.",
                ),
              ),
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
          ),
      );
      const body = {
        location: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
        },
        idempotency_key: crypto.randomUUID(),
      };
      await result(
        api.POST(
          kind === "in"
            ? "/api/v1/attendance/punch-in"
            : "/api/v1/attendance/punch-out",
          { body },
        ),
      );
    }, `Punch ${kind} recorded`);
  }
  if (!data) return <LoadState loading={loading} error={error} />;
  const attendance = data.attendance;
  return (
    <div className="stack">
      <div className="row spread">
        <span className="muted">
          {dateOnlyText(data.today)} · {data.timezone}
        </span>
        <Badge value={attendance?.status || "not punched in"} />
      </div>
      <div className="grid employee-dashboard-stats">
        <Stat
          label={`Office clock · ${data.timezone}`}
          value={<ServerClock />}
          icon={CalendarDays}
        />
        <Stat
          label="Assigned Shift"
          value={data.shift?.name || "Not Assigned"}
        />
        <Stat
          label="Expected Working Hours"
          value={
            data.shift
              ? durationText(data.shift.expected_working_minutes)
              : "Not Assigned"
          }
        />
        <Stat
          label="Actual Worked Hours"
          value={
            attendance?.status === "work_from_home" && !attendance.punch_in
              ? "Not Tracked"
              : attendance
                ? durationText(attendance.net_minutes)
                : "—"
          }
        />
        <Stat
          label="Unexcused Late Arrivals This Month"
          value={data.late_count}
          icon={TriangleAlert}
        />
      </div>
      <p className="muted">
        Expected working hours are the assigned shift duration minus one hour.
      </p>
      <section className="card">
        <div className="row spread">
          <div>
            <h2>Today’S Attendance</h2>
            <p className="muted">
              {data.shift
                ? `${timeText(data.shift.starts_at)} – ${timeText(data.shift.ends_at)}`
                : "Ask your administrator to assign your working shift."}
            </p>
          </div>
          <ShieldCheck className="stat-icon" size={28} />
        </div>
        {attendance?.status === "work_from_home" ? (
          <p className="muted">
            Work From Home is recorded for today. Punch In and Punch Out are not
            required or available.
          </p>
        ) : (
          <div className="row">
            <button
              className="primary"
              disabled={busy || !data.shift || Boolean(attendance?.punch_in)}
              onClick={() => void punch("in")}
            >
              <LogIn size={18} />
              Punch In
            </button>
            <button
              disabled={
                busy || !attendance?.punch_in || Boolean(attendance?.punch_out)
              }
              onClick={() => void punch("out")}
            >
              <LogOut size={18} />
              Punch Out
            </button>
            <small>
              Both Office Network And Location Verification Are Required.
            </small>
          </div>
        )}
        {attendance?.punch_in && attendance.status !== "work_from_home" && (
          <p className="muted" style={{ marginTop: 20, marginBottom: 0 }}>
            Started {dateText(attendance.punch_in, data.timezone)}
            {attendance.punch_out
              ? ` · Finished ${dateText(attendance.punch_out, data.timezone)}`
              : " · Your workday is still open"}
          </p>
        )}
      </section>
      <div className="grid cols-2">
        <section className="card">
          <div className="row spread">
            <h2>Calendar & Schedule</h2>
            <CalendarDays className="stat-icon" size={21} />
          </div>
          <p className="muted">View your assigned shifts and holidays.</p>
          <Link href="/employee/calendar" className="button">
            Open Calendar
          </Link>
        </section>
      </div>
    </div>
  );
}

export function EmployeeAttendance() {
  const [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0);
  const pageSize = useRecordPageSize();
  const loader = useCallback(
    () =>
      result(
        api.GET("/api/v1/me/attendance", {
          params: {
            query: {
              start: start || undefined,
              end: end || undefined,
              status: status || undefined,
              offset,
              limit: pageSize + 1,
            },
          },
        }),
      ),
    [start, end, status, offset, pageSize],
  );
  const { data, loading, error } = useLoad(loader);
  return (
    <div className="stack">
      <section
        className="card attendance-filter-card"
        aria-label="Attendance Filters"
      >
        <div className="attendance-filter-bar employee-filter-bar">
          <div
            className="attendance-date-range"
            role="group"
            aria-label="Date Range"
          >
            <Field label="Start Date">
              <DateInput
                aria-label="Start Date"
                openOnClick
                value={start}
                onValueChange={(value) => {
                  setStart(value);
                  setOffset(0);
                }}
              />
            </Field>
            <span className="date-range-separator">to</span>
            <Field label="End Date">
              <DateInput
                aria-label="End Date"
                openOnClick
                value={end}
                onValueChange={(value) => {
                  setEnd(value);
                  setOffset(0);
                }}
              />
            </Field>
          </div>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setOffset(0);
              }}
            >
              <option value="" hidden>
                All Records
              </option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="work_from_home">Work From Home</option>
            </select>
          </Field>
        </div>
      </section>
      {data ? (
        <section className="card">
          <h2>Attendance History</h2>
          <AttendanceTable rows={data.slice(0, pageSize)} />
          <RecordPagination
            offset={offset}
            count={Math.min(data.length, pageSize)}
            hasMore={data.length > pageSize}
            pageSize={pageSize}
            onPage={setOffset}
          />
        </section>
      ) : (
        <LoadState loading={loading} error={error} />
      )}
    </div>
  );
}

export function Notifications() {
  const loader = useCallback(
    () => result(api.GET("/api/v1/notifications")),
    [],
  );
  const { data, loading, error } = useLoad(loader),
    { act, busy } = useApp();
  const [filter, setFilter] = useState("all");
  if (!data) return <LoadState loading={loading} error={error} />;
  const rows = data.filter(
    (n) =>
      filter === "all" || (filter === "unread" ? !n.read : n.kind === filter),
  );
  return (
    <section className="card">
      <div className="row" style={{ marginBottom: 24 }}>
        {["all", "unread", "attendance", "late_arrival", "calendar"].map(
          (f) => (
            <button
              key={f}
              className={filter === f ? "primary" : ""}
              onClick={() => setFilter(f)}
            >
              {titleLabel(f)}
            </button>
          ),
        )}
      </div>
      {rows.length ? (
        <div className="stack">
          {rows.map((n) => (
            <article className="card" key={n.id}>
              <div className="row spread">
                <Badge value={n.kind} />
                <small>{dateText(n.created_at)}</small>
              </div>
              <p style={{ marginTop: 16 }}>{n.message}</p>
              {!n.read && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void act(
                      () =>
                        result(
                          api.POST(
                            "/api/v1/notifications/{notification_id}/read",
                            { params: { path: { notification_id: n.id } } },
                          ),
                        ),
                      "Marked as read",
                    )
                  }
                >
                  Mark As Read
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No Notifications">
          Attendance updates will appear here.
        </Empty>
      )}
    </section>
  );
}

export function Profile() {
  const { user, act, busy } = useApp();
  return (
    <div className="stack">
      <section className="card">
        <h2>Employee Information</h2>
        <div className="grid cols-3">
          <div>
            <small>Full Name</small>
            <p>{user.name}</p>
          </div>
          <div>
            <small>Company Email</small>
            <p>{user.email}</p>
          </div>
          <div>
            <small>Employee ID</small>
            <p>{user.employee_code}</p>
          </div>
        </div>
        <small>
          Contact your administrator to update your employee information.
        </small>
      </section>
      <section className="card">
        <h2>Password & Security</h2>
        <p className="muted">
          Request a single-use recovery link for {user.email}. Open the link to
          choose a new password and PIN.
        </p>
        <button
          className="primary"
          disabled={busy}
          onClick={() =>
            void act(
              () =>
                result(
                  api.POST("/api/v1/auth/recovery/request", {
                    body: { email: user.email },
                  }),
                ),
              "Recovery instructions requested. Check your company email.",
            )
          }
        >
          Send Recovery Link
        </button>
      </section>
    </div>
  );
}
