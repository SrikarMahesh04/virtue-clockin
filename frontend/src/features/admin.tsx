"use client";
import { titleLabel } from "@/lib/labels";
import {
  RecordPagination,
  useRecordPageSize,
} from "@/components/record-pagination";
import { DateInput } from "@/components/date-input";
import { useCallback, useState } from "react";
import { Users, TriangleAlert } from "lucide-react";
import { api, API_URL, Models, result, message } from "@/services/api";
import { Badge, Alert, Drawer, Empty, Field, localDate } from "@/components/ui";
import { LoadState, useApp, useLoad } from "./shell";
import { AttendanceTable, Stat } from "./employee";
import { ShiftTimeFields } from "@/components/shift-time-fields";
import { dateOnlyText, timeText } from "@/lib/time";
import { Modal } from "@/components/modal";

export function AdminDashboard() {
  const loader = useCallback(
    async () => ({
      dashboard: await result(api.GET("/api/v1/admin/dashboard")),
      employees: await result(api.GET("/api/v1/employees")),
    }),
    [],
  );
  const { data, loading, error } = useLoad(loader);
  if (!data) return <LoadState loading={loading} error={error} />;
  const d = data.dashboard;
  return (
    <div className="stack">
      <div className="grid cols-4">
        <Stat label="Active Employees" value={d.total_employees} icon={Users} />
        <Stat label="Punched In Today" value={d.present} />
        <Stat label="Absent After Shift End" value={d.absent} />
        <Stat label="Late Today" value={d.late} icon={TriangleAlert} />
        <Stat label="Work From Home Today" value={d.work_from_home} />
      </div>
      <section className="card">
        <h2>Today’S Attendance</h2>
        <AttendanceTable rows={d.attendance} employees={data.employees} />
      </section>
      <div className="grid cols-2">
        <section className="card">
          <h2>Monthly Late-Arrival Review</h2>
          {d.flags.length ? (
            d.flags.map((f) => (
              <div key={f.id} className="row spread" style={{ padding: 12 }}>
                <span>
                  {data.employees.find((e) => e.id === f.user_id)?.name ||
                    f.user_id}{" "}
                  · {f.month} · {f.count} lates
                </span>
                <Badge value={f.state} />
              </div>
            ))
          ) : (
            <Empty title="No Late-Arrival Flags">
              Warnings appear at five lates; review flags appear at six.
            </Empty>
          )}
        </section>
        <section className="card">
          <h2>Open Workdays</h2>
          <p className="stat-value">{d.incomplete}</p>
          <p className="muted">
            Attendance records without a Punch Out today. Earlier incomplete
            records can be reviewed in Attendance.
          </p>
        </section>
      </div>
    </div>
  );
}

export function Employees() {
  const loader = useCallback(
    async () => ({
      employees: await result(api.GET("/api/v1/employees")),
      shifts: await result(api.GET("/api/v1/shifts")),
      assignments: await result(api.GET("/api/v1/assignments")),
      clock: await result(api.GET("/api/v1/time", { cache: "no-store" })),
    }),
    [],
  );
  const { data, loading, error } = useLoad(loader),
    { act, busy } = useApp();
  const [editing, setEditing] = useState<Models["UserView"] | "new" | null>(
      null,
    ),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const [formRole, setFormRole] = useState("employee");
  const [accountError, setAccountError] = useState("");
  const close = useCallback(() => {
    setEditing(null);
    setAccountError("");
  }, []);
  const employee = editing && editing !== "new" ? editing : null;
  function sendAccountLink(purpose: "activation" | "recovery") {
    if (!employee) return;
    setAccountError("");
    void act(
      async () => {
        try {
          await result(
            api.POST(
              purpose === "activation"
                ? "/api/v1/employees/{employee_id}/activation-link"
                : "/api/v1/employees/{employee_id}/reset",
              {
                params: { path: { employee_id: employee.id } },
              },
            ),
          );
        } catch (failure) {
          setAccountError(message(failure));
          throw failure;
        }
      },
      purpose === "activation"
        ? "Activation link sent"
        : "Password reset link sent",
    );
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: Models["EmployeeInput"] = {
      name: String(f.get("name")),
      email: String(f.get("email")),
      date_of_joining: String(f.get("date_of_joining") || "") || null,
      role: String(f.get("role")) as Models["EmployeeInput"]["role"],
      active: f.get("active") === "on",
    };
    if (
      await act(
        () =>
          result(
            employee
              ? api.PUT("/api/v1/employees/{employee_id}", {
                  params: { path: { employee_id: employee.id } },
                  body,
                })
              : api.POST("/api/v1/employees", { body }),
          ),
        "Employee saved. Issue an activation link through email or the local operator command.",
      )
    )
      close();
  }
  if (!data) return <LoadState loading={loading} error={error} />;
  const dateParts = new Intl.DateTimeFormat("en-US", {
    timeZone: data.clock.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(data.clock.instant));
  const today = ["year", "month", "day"]
    .map((part) => dateParts.find((value) => value.type === part)!.value)
    .join("-");
  function directoryShift(person: Models["UserView"]) {
    if (person.role !== "employee") return "—";
    const assignments = data!.assignments.filter(
      (assignment) => assignment.user_id === person.id,
    );
    const current = assignments.find(
      (assignment) =>
        assignment.valid_from <= today &&
        (!assignment.valid_to || assignment.valid_to >= today),
    );
    const upcoming = assignments
      .filter((assignment) => assignment.valid_from > today)
      .sort((a, b) => a.valid_from.localeCompare(b.valid_from))[0];
    const assignment = current || upcoming;
    const shift = data!.shifts.find((item) => item.id === assignment?.shift_id);
    if (!shift)
      return assignment ? "Assigned shift unavailable" : "Not Assigned";
    return `${shift.name} · ${timeText(shift.starts_at)} – ${timeText(shift.ends_at)}${!current && upcoming ? ` · Starts ${dateOnlyText(upcoming.valid_from)}` : ""}`;
  }
  const rows = data.employees.filter(
    (e) =>
      `${e.name} ${e.email} ${e.employee_code || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || String(e.active) === status),
  );
  return (
    <div className="stack">
      <section className="card">
        <div className="row spread">
          <h2>Employee Directory</h2>
          <button
            className="primary"
            onClick={() => {
              setFormRole("employee");
              setEditing("new");
            }}
          >
            + Add Employee
          </button>
        </div>
        <div className="form-grid" style={{ marginBottom: 24 }}>
          <Field label="Search Employees">
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </Field>
          <Field label="Account Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All Accounts</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </Field>
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Employee ID</th>
                  <th>Date Of Joining</th>
                  <th>Role</th>
                  <th>Shift</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      {e.name}
                      <br />
                      <small>{e.email}</small>
                    </td>
                    <td>
                      {e.role === "employee" ? e.employee_code || "—" : "—"}
                    </td>
                    <td>
                      {e.role === "employee" && e.date_of_joining
                        ? dateOnlyText(e.date_of_joining)
                        : "—"}
                    </td>
                    <td>{titleLabel(e.role)}</td>
                    <td>{directoryShift(e)}</td>
                    <td>
                      <Badge value={e.active ? "active" : "inactive"} />
                    </td>
                    <td>
                      <button
                        onClick={() => {
                          setFormRole(e.role);
                          setEditing(e);
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No Employees Found">
            Add real employee accounts to begin.
          </Empty>
        )}
      </section>
      {editing && (
        <Drawer
          title={employee ? "Edit Employee" : "Add Employee"}
          close={close}
        >
          <form className="form" onSubmit={save}>
            <Field label="Full Name">
              <input
                name="name"
                defaultValue={employee?.name || ""}
                maxLength={160}
                required
              />
            </Field>
            <Field label="Corporate Email">
              <input
                name="email"
                type="email"
                defaultValue={employee?.email || ""}
                required
              />
            </Field>
            <Field label="Role">
              <select
                name="role"
                value={formRole}
                required
                onChange={(event) => setFormRole(event.target.value)}
              >
                <option value="" disabled>
                  Select Role
                </option>
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </Field>
            {formRole === "employee" && (
              <>
                <Field label="Date Of Joining (DOJ)">
                  <DateInput
                    aria-label="Date Of Joining (DOJ)"
                    name="date_of_joining"
                    openOnClick
                    defaultValue={employee?.date_of_joining || ""}
                    required={
                      !employee ||
                      employee.role !== "employee" ||
                      Boolean(employee.date_of_joining)
                    }
                  />
                </Field>
                {employee?.role === "employee" && employee.employee_code ? (
                  <p>
                    <strong>Employee ID:</strong> {employee.employee_code}
                  </p>
                ) : (
                  <small>
                    Employee ID is generated automatically from the joining
                    month when saved.
                  </small>
                )}
              </>
            )}
            <label className="row">
              <input
                type="checkbox"
                name="active"
                defaultChecked={employee?.active ?? true}
              />
              Account Active
            </label>
            <button className="primary" disabled={busy}>
              Save Employee
            </button>
            {employee && (
              <div className="stack">
                <div className="row">
                  <button
                    type="button"
                    disabled={
                      busy || !employee.active || employee.account_activated
                    }
                    onClick={() => sendAccountLink("activation")}
                  >
                    Send Activation Link
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy || !employee.active || !employee.account_activated
                    }
                    onClick={() => sendAccountLink("recovery")}
                  >
                    Reset Password
                  </button>
                </div>
                {accountError && <Alert text={accountError} />}
                <small>
                  {!employee.active
                    ? "Activate the account before sending a link."
                    : employee.account_activated
                      ? "Account activated. Use Reset Password to send a recovery link."
                      : "Account awaiting activation. Send Activation Link lets the employee choose their password and PIN."}
                </small>
              </div>
            )}
            <small>
              Without email configuration, the operator can issue a private
              account link. Employees choose their own password and PIN.
            </small>
          </form>
          {employee?.role === "employee" && (
            <div style={{ marginTop: 32 }}>
              <h3>Shift Assignment</h3>
              <p className="muted">
                Latest assigned shift:{" "}
                {data.shifts.find(
                  (shift) =>
                    shift.id ===
                    data.assignments.find(
                      (assignment) => assignment.user_id === employee.id,
                    )?.shift_id,
                )?.name || "Not Assigned"}
              </p>
              <form
                className="form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void act(
                    () =>
                      result(
                        api.PUT("/api/v1/employees/{employee_id}/shift", {
                          params: { path: { employee_id: employee.id } },
                          body: { shift_id: String(f.get("shift")) },
                        }),
                      ),
                    "Shift assigned",
                  );
                }}
              >
                <div className="form">
                  <Field label="Shift">
                    <select name="shift" required defaultValue="">
                      <option value="" disabled>
                        Select Shift
                      </option>
                      {data.shifts
                        .filter((s) => s.active)
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                </div>
                <button className="primary" disabled={busy || !employee.active}>
                  Assign Shift
                </button>
              </form>
              <small>
                The selected shift applies from today, or the joining date for a
                future hire.
              </small>
            </div>
          )}
        </Drawer>
      )}
    </div>
  );
}

export function Shifts() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [editing, setEditing] = useState<Models["ShiftView"] | null>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [deleting, setDeleting] = useState(false);
  const loader = useCallback(
    async () => ({
      shifts: await result(api.GET("/api/v1/shifts")),
    }),
    [],
  );
  const { data, loading, error } = useLoad(loader),
    { act, busy } = useApp();
  function closeDialog() {
    if (busy) return;
    setDialogOpen(false);
    setEditing(null);
    setStart("");
    setEnd("");
    setDeleting(false);
    setFormError("");
  }
  function save(action: () => Promise<unknown>, success: string) {
    setFormError("");
    return act(async () => {
      try {
        await action();
      } catch (error) {
        setFormError(message(error));
        throw error;
      }
    }, success);
  }
  if (!data) return <LoadState loading={loading} error={error} />;
  return (
    <div className="stack">
      <section className="card">
        <div className="row spread shift-list-heading">
          <h2>Shift Definitions</h2>
          <button
            type="button"
            className="primary"
            onClick={() => {
              setEditing(null);
              setStart("");
              setEnd("");
              setDeleting(false);
              setFormError("");
              setDialogOpen(true);
            }}
          >
            Create New Shift
          </button>
        </div>
        {data.shifts.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Shift</th>
                  <th>Working Time</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.shifts.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>
                      {timeText(s.starts_at)} – {timeText(s.ends_at)}
                    </td>
                    <td>
                      <Badge value={s.active ? "active" : "inactive"} />
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(s);
                          setStart(s.starts_at.slice(0, 5));
                          setEnd(s.ends_at.slice(0, 5));
                          setDeleting(false);
                          setFormError("");
                          setDialogOpen(true);
                        }}
                        aria-label={`Edit ${s.name}`}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No Shifts Configured">
            Create a shift with its start and end times.
          </Empty>
        )}
      </section>
      {dialogOpen && (
        <Modal
          title={editing ? `Edit Shift: ${editing.name}` : "Create New Shift"}
          close={closeDialog}
          busy={busy}
        >
          {formError && <Alert text={formError} />}
          <form
            key={editing?.id || "new"}
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget,
                f = new FormData(form);
              const body = {
                name: String(f.get("name")),
                starts_at: String(f.get("start")),
                ends_at: String(f.get("end")),
                active: editing ? f.get("active") === "true" : true,
              };
              void save(
                () =>
                  editing
                    ? result(
                        api.PUT("/api/v1/shifts/{shift_id}", {
                          params: { path: { shift_id: editing.id } },
                          body,
                        }),
                      )
                    : result(api.POST("/api/v1/shifts", { body })),
                editing ? "Shift updated" : "Shift created",
              ).then((ok) => {
                if (ok) {
                  form.reset();
                  setEditing(null);
                  setStart("");
                  setEnd("");
                  setDeleting(false);
                  setDialogOpen(false);
                }
              });
            }}
          >
            <Field label="Shift Name">
              <input name="name" required defaultValue={editing?.name || ""} />
            </Field>
            <ShiftTimeFields
              start={start}
              end={end}
              onStart={setStart}
              onEnd={setEnd}
            />
            {editing && (
              <Field label="Shift Status">
                <select
                  name="active"
                  defaultValue={editing?.active === false ? "false" : "true"}
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </Field>
            )}
            <small>
              {editing
                ? "Changes apply to future attendance records. Recorded days keep their saved timings. Inactive shifts cannot be assigned or used for a new attendance day."
                : "Choose the start and end times for a same-day shift."}
            </small>
            <button className="primary" disabled={busy || !start || !end}>
              {editing ? "Save Changes" : "Save Shift"}
            </button>
            <div className="row">
              <button type="button" disabled={busy} onClick={closeDialog}>
                Cancel
              </button>
              {editing && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleting(true)}
                >
                  Delete Shift
                </button>
              )}
            </div>
            {editing && deleting && (
              <div
                role="group"
                aria-label="Confirm Shift Deletion"
                className="alert error"
              >
                <p>
                  Delete {editing.name}? Employees assigned to it will need
                  another active shift for new attendance days. Recorded
                  attendance and assignment history will be preserved.
                </p>
                <div className="row">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      void save(
                        () =>
                          result(
                            api.DELETE("/api/v1/shifts/{shift_id}", {
                              params: { path: { shift_id: editing.id } },
                            }),
                          ),
                        "Shift deleted",
                      ).then((ok) => {
                        if (ok) {
                          setEditing(null);
                          setStart("");
                          setEnd("");
                          setDeleting(false);
                          setDialogOpen(false);
                        }
                      });
                    }}
                  >
                    Confirm Delete
                  </button>
                  <button type="button" onClick={() => setDeleting(false)}>
                    Keep Shift
                  </button>
                </div>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}

export function AdminAttendance() {
  const [start, setStart] = useState(
      localDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    ),
    [end, setEnd] = useState(localDate()),
    [employee, setEmployee] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0);
  const pageSize = useRecordPageSize();
  const [rangeStart, setRangeStart] = useState(start);
  const [rangeEnd, setRangeEnd] = useState(end);
  function changeRange(from: string, to: string) {
    setRangeStart(from);
    setRangeEnd(to);
    if (
      from &&
      to &&
      to >= from &&
      Date.parse(to) - Date.parse(from) <= 366 * 86400000
    ) {
      setStart(from);
      setEnd(to);
      setOffset(0);
    }
  }
  const rangeInvalid =
    !rangeStart ||
    !rangeEnd ||
    rangeEnd < rangeStart ||
    Date.parse(rangeEnd) - Date.parse(rangeStart) > 366 * 86400000;
  const query = {
    start,
    end,
    employee_id: employee || undefined,
    status: status || undefined,
    offset,
    limit: pageSize + 1,
  };
  const loader = useCallback(
    async () => ({
      rows: await result(
        api.GET("/api/v1/admin/attendance", {
          params: {
            query: {
              start,
              end,
              employee_id: employee || undefined,
              status: status || undefined,
              offset,
              limit: pageSize + 1,
            },
          },
        }),
      ),
      employees: await result(api.GET("/api/v1/employees")),
    }),
    [start, end, employee, status, offset, pageSize],
  );
  const { data, loading, error } = useLoad(loader),
    { act, busy } = useApp();
  if (!data)
    return (
      <div className="stack">
        <LoadState loading={loading} error={error} />
        {error && (
          <button
            onClick={() => {
              setStart(localDate());
              setEnd(localDate());
              setRangeStart(localDate());
              setRangeEnd(localDate());
              setEmployee("");
              setStatus("");
              setOffset(0);
            }}
          >
            Reset Filters To Today
          </button>
        )}
      </div>
    );
  const rows = data.rows.slice(0, pageSize);
  async function download() {
    await act(async () => {
      const params = new URLSearchParams(
        Object.entries(query)
          .filter(
            ([k, v]) => v !== undefined && !["offset", "limit"].includes(k),
          )
          .map(([k, v]) => [k, String(v)]),
      );
      params.delete("offset");
      params.delete("limit");
      const response = await fetch(
        `${API_URL}/api/v1/reports/attendance.csv?${params}`,
        { credentials: "include" },
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Export failed");
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "attendance.csv";
      a.click();
      URL.revokeObjectURL(url);
    }, "CSV exported");
  }
  return (
    <div className="stack">
      <section
        className="card attendance-filter-card"
        aria-label="Attendance Filters"
      >
        <h2 className="sr-only">Attendance Filters</h2>
        <div className="attendance-filter-bar with-export">
          <div
            className="attendance-date-range"
            role="group"
            aria-label="Date Range"
          >
            <Field label="Start Date">
              <DateInput
                aria-label="Start Date"
                openOnClick
                value={rangeStart}
                onValueChange={(value) => changeRange(value, rangeEnd)}
                required
              />
            </Field>
            <span className="date-range-separator">to</span>
            <Field label="End Date">
              <DateInput
                aria-label="End Date"
                openOnClick
                value={rangeEnd}
                onValueChange={(value) => changeRange(rangeStart, value)}
                required
              />
            </Field>
          </div>
          <Field label="Employee">
            <select
              value={employee}
              onChange={(e) => {
                setEmployee(e.target.value);
                setOffset(0);
              }}
            >
              <option value="">All Employees</option>
              {data.employees
                .filter((e) => e.role === "employee")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
            </select>
          </Field>
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
          <button
            className="primary"
            disabled={busy || rangeInvalid}
            onClick={() => void download()}
          >
            Export CSV
          </button>
        </div>
        {rangeInvalid && (
          <p role="alert">
            Choose a start and end date in order, no more than one year apart.
            Records keep the last valid range until both dates are valid.
          </p>
        )}
      </section>
      <section className="card">
        <h2>Attendance Records</h2>
        <AttendanceTable rows={rows} employees={data.employees} />
        <RecordPagination
          offset={offset}
          count={rows.length}
          hasMore={data.rows.length > pageSize}
          pageSize={pageSize}
          onPage={setOffset}
        />
      </section>
    </div>
  );
}
