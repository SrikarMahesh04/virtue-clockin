import { dateOnlyText } from "../src/lib/time";
import { test, expect, Page } from "@playwright/test";
import { readFileSync } from "node:fs";

for (const host of [
  "localhost",
  "127.0.0.1",
  ...(process.env.TEST_LAN_HOST ? [process.env.TEST_LAN_HOST] : []),
]) {
  test(`administrator password/PIN sessions and mutations through ${host}`, async ({
    page,
  }) => {
    const origin = `http://${host}:3000`;
    if (host === process.env.TEST_LAN_HOST)
      await page.setViewportSize({ width: 390, height: 844 });
    for (const method of ["password", "pin"]) {
      await page.goto(`${origin}${method === "pin" ? "/login/pin" : "/login"}`);
      const response = page.waitForResponse(
        `http://${host}:8000/api/v1/auth/login`,
      );
      await page.getByLabel("Company Email Address").fill("admin@example.com");
      const credential = page.getByLabel(
        method === "pin" ? "Your Six-Digit PIN" : "Password",
        {
          exact: true,
        },
      );
      if (method === "pin") {
        await expect(credential).toHaveValue("");
        await expect(credential).toHaveAttribute("autocomplete", "off");
      }
      const secret = method === "pin" ? "012345" : "browser-test-password-long";
      await credential.fill(secret);
      const label = method === "pin" ? "your six-digit pin" : "password";
      const show = page.getByRole("button", {
        name: `Show ${label}`,
        exact: true,
      });
      await show.focus();
      await page.keyboard.press("Enter");
      await expect(credential).toHaveAttribute("type", "text");
      await expect(credential).toHaveValue(secret);
      await expect(page).toHaveURL(
        method === "pin" ? `${origin}/login/pin` : `${origin}/login`,
      );
      if (method === "pin" && host === "localhost") {
        await page.screenshot({ path: "../.tools/login-pin-visibility.png" });
      }
      await page
        .getByRole("button", { name: `Hide ${label}`, exact: true })
        .click();
      await expect(credential).toHaveAttribute("type", "password");
      await page.getByRole("button", { name: "Sign In", exact: true }).click();
      expect((await response).status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      const logout = page.waitForResponse(
        `http://${host}:8000/api/v1/auth/logout`,
      );
      await page
        .getByRole("button", { name: "Sign Out", exact: true })
        .filter({ visible: true })
        .first()
        .click();
      expect((await logout).status()).toBe(200);
      await expect(
        page.getByRole("heading", { name: "Welcome To ClockIn" }),
      ).toBeVisible();
    }
  });
}

async function login(page: Page, who = "employee", pin = false) {
  await page.goto(pin ? "/login/pin" : "/login");
  await page.getByLabel("Company Email Address").fill(`${who}@example.com`);
  await page
    .getByLabel(pin ? "Your Six-Digit PIN" : "Password", { exact: true })
    .fill(pin ? "012345" : "browser-test-password-long");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
}

test("shift timings use six-row AM/PM dropdowns and support editing, status and deletion", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin/shifts");
  await expect(
    page.getByRole("heading", { name: "Shift Timings", exact: true }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/lunch/i);
  const create = page.getByRole("button", {
    name: "Create New Shift",
    exact: true,
  });
  await expect(page.getByLabel("Shift Name", { exact: true })).toHaveCount(0);
  await create.click();
  const dialog = page.getByRole("dialog", {
    name: "Create New Shift",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(
    Math.abs(bounds!.x + bounds!.width / 2 - page.viewportSize()!.width / 2),
  ).toBeLessThan(3);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(create).toBeFocused();
  await create.click();
  await dialog.getByRole("button", { name: "Close Dialog" }).click();
  await expect(dialog).toHaveCount(0);
  await create.click();
  await dialog.press("Escape");
  await expect(dialog).toHaveCount(0);
  await create.click();
  await page.setViewportSize({ width: 1280, height: 640 });
  await page
    .getByLabel("Shift Name", { exact: true })
    .fill("Afternoon timing test");
  await page.getByRole("combobox", { name: "Start Time", exact: true }).click();
  const menu = page.getByRole("listbox", { name: "Start Time", exact: true });
  expect(await menu.evaluate((element) => element.clientHeight)).toBe(264);
  expect(
    await dialog.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  expect(
    await menu.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  await page.getByRole("option", { name: "12:30 PM", exact: true }).click();
  await page.getByRole("combobox", { name: "End Time", exact: true }).click();
  expect(
    await dialog.evaluate(
      (element) => element.scrollHeight <= element.clientHeight,
    ),
  ).toBe(true);
  await page.getByRole("option", { name: "1:00 PM", exact: true }).click();
  await expect(page.locator("main")).not.toContainText(/UTC|Kolkata|time zone/);
  await expect(dialog.getByLabel("Shift Status")).toHaveCount(0);
  await page.getByRole("combobox", { name: "Start Time", exact: true }).click();
  await page.screenshot({
    path: "../.tools/shift-timings.png",
    fullPage: true,
  });
  await page
    .getByRole("combobox", { name: "Start Time", exact: true })
    .press("Escape");
  await expect(dialog).toBeVisible();
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/shifts") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save Shift", exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON().active).toBe(true);
  await expect(dialog).toHaveCount(0);
  expect(Object.keys(response.request().postDataJSON())).toEqual([
    "name",
    "starts_at",
    "ends_at",
    "active",
  ]);
  const row = page
    .getByRole("row")
    .filter({ hasText: "Afternoon timing test" });
  await expect(row).toContainText("12:30 PM – 1:00 PM");
  await expect(row.locator(".badge")).toHaveText("Active");
  await row.getByRole("button", { name: "Edit Afternoon timing test" }).click();
  await expect(
    page.getByRole("dialog", { name: "Edit Shift: Afternoon timing test" }),
  ).toBeVisible();
  await expect(page.getByLabel("Shift Name", { exact: true })).toHaveValue(
    "Afternoon timing test",
  );
  await page.getByRole("combobox", { name: "Start Time", exact: true }).click();
  await page.getByRole("option", { name: "11:30 AM", exact: true }).click();
  await page.getByLabel("Shift Status").selectOption("false");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(row).toContainText("11:30 AM – 1:00 PM");
  await expect(row.locator(".badge")).toHaveText("Inactive");
  await row.getByRole("button", { name: "Edit Afternoon timing test" }).click();
  await page.getByRole("button", { name: "Delete Shift", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm Delete", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  await expect(page.locator(".topbar")).toContainText(/\d+:\d+ (AM|PM)/);
});

test("record arrows page persisted attendance and server clock ignores browser date changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "admin");
  const authoritative = await page.evaluate(async () => {
    const response = await fetch("http://localhost:8000/api/v1/time", {
      credentials: "include",
    });
    return await response.json();
  });
  await page.clock.setFixedTime(new Date("2036-01-01T23:59:00Z"));
  await page.reload();
  const expected = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: authoritative.timezone,
  }).format(new Date(authoritative.instant));
  await expect(page.getByLabel("Office Time", { exact: true })).toHaveText(
    expected,
  );
  await expect(page.getByText(/device time/i)).toHaveCount(0);
  await page.goto("/admin/attendance");
  const end = authoritative.instant.slice(0, 10);
  const start = new Date(Date.parse(authoritative.instant) - 15 * 86400000)
    .toISOString()
    .slice(0, 10);
  await page
    .getByRole("textbox", { name: "Start Date", exact: true })
    .fill(dateOnlyText(start));
  await page
    .getByRole("textbox", { name: "End Date", exact: true })
    .fill(dateOnlyText(end));
  await page
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption({ label: "Employee" });
  await expect(
    page.getByRole("navigation", { name: "Record Pages" }),
  ).toBeVisible();
  const first = await page.locator("tbody tr").first().textContent();
  await expect(
    page.getByRole("button", { name: "Previous Records" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next Records" }).click();
  await expect(page.locator("tbody tr").first()).not.toHaveText(first!);
  await page.getByRole("button", { name: "Previous Records" }).click();
  await expect(page.locator("tbody tr").first()).toHaveText(first!);
});

if (process.env.TEST_LAN_HOST) {
  test("phone LAN session works and location explains the HTTPS requirement", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`http://${process.env.TEST_LAN_HOST}:3000/login/pin`);
    await page.getByLabel("Company Email Address").fill("employee@example.com");
    await page.getByLabel("Your Six-Digit PIN", { exact: true }).fill("012345");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Punch In", exact: true }).click();
    await expect(page.locator("main .alert.error")).toContainText(
      "Location verification requires HTTPS",
    );
    await expect(
      page.getByText("Cannot reach the API", { exact: false }),
    ).toHaveCount(0);
  });
}

test("unconfigured Maps preserves the saved office when updating its radius", async ({
  page,
}) => {
  await login(page, "admin");
  await page.goto("/admin/settings");
  await expect(page.getByText("Google Maps Is Not Configured")).toBeVisible();
  await expect(
    page.getByText("Office location selected", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Office latitude")).toHaveCount(0);
  await expect(page.getByLabel("Office longitude")).toHaveCount(0);
  await page.getByLabel("Geofence Radius (Meters)").fill("250");
  const saved = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/settings") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save Office Configuration" }).click();
  const response = await saved;
  expect(response.status()).toBe(200);
  expect((await response.json()).policy).toMatchObject({
    latitude: 0,
    longitude: 0,
    radius_m: 250,
  });
  await page.reload();
  await expect(page.getByLabel("Geofence Radius (Meters)")).toHaveValue("250");
});

test("employee email/PIN login, real punches, calendar and notifications", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 0, longitude: 0, accuracy: 5 });
  await login(page, "employee", true);
  const expectedCard = page
    .locator(".card")
    .filter({ has: page.getByText("Expected Working Hours", { exact: true }) });
  await expect(expectedCard.locator(".stat-value")).toHaveText("8h 0min");
  await page.screenshot({
    path: "../.tools/employee-dashboard-working-hours.png",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Sign Out", exact: true }),
  ).toHaveCount(1);
  await expect(
    page
      .locator("aside")
      .getByRole("button", { name: "Sign Out", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Punch In", exact: true }).click();
  await expect(page.locator("main .alert.success")).toContainText(
    "Punch in recorded",
  );
  await page.getByRole("button", { name: "Punch Out", exact: true }).click();
  await expect(page.locator("main .alert.success")).toContainText(
    "Punch out recorded",
  );
  await expect(page.getByRole("link", { name: "My notes" })).toHaveCount(0);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  const details = page.getByRole("region", {
    name: "Calendar Options",
    exact: true,
  });
  await expect(
    details.getByRole("heading", { name: "Selected Date", exact: true }),
  ).toBeVisible();
  await expect(details.locator("dt")).toHaveText(["Punch In", "Punch Out"]);
  await expect(details).toContainText("Expected working hours: 8h 0min");
  await expect(details.locator("dd")).toHaveText([
    /\d{2}-[A-Z][a-z]{2}-\d{4}, .* (AM|PM)/,
    /\d{2}-[A-Z][a-z]{2}-\d{4}, .* (AM|PM)/,
  ]);
  await expect(
    details.getByText(/weekly off|work from home|worked/i),
  ).toHaveCount(0);
  await page.screenshot({
    path: "../.tools/employee-calendar-punches.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Notifications", exact: true })
    .first()
    .click();
  await expect(page.getByText(/Punch In recorded at/)).toBeVisible();
  for (const route of ["attendance", "profile"]) {
    await page.goto(`/employee/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("Loading your records…")).toHaveCount(0);
    await expect(page.locator("main .alert.error")).toHaveCount(0);
  }
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("New six-digit PIN", { exact: true }),
  ).toHaveCount(0);
  const recovery = page.waitForResponse((response) =>
    response.url().endsWith("/api/v1/auth/recovery/request"),
  );
  await page
    .getByRole("button", { name: "Send Recovery Link", exact: true })
    .click();
  const recoveryResponse = await recovery;
  expect(recoveryResponse.request().postDataJSON()).toEqual({
    email: "employee@example.com",
  });
  expect(recoveryResponse.status()).toBe(503);
  await expect(page.locator("main .alert.error")).toContainText(
    "Email recovery is unavailable",
  );
  await page.goto("/employee/attendance");
  const filters = page.getByRole("region", {
    name: "Attendance Filters",
    exact: true,
  });
  await expect(filters).toBeVisible();
  const bounds = (await filters.boundingBox())!;
  expect(bounds.height).toBeLessThan(100);
  const start = filters.getByLabel("Start Date", { exact: true });
  const end = filters.getByLabel("End Date", { exact: true });
  const status = filters.getByRole("combobox", { name: "Status", exact: true });
  expect(
    Math.abs((await start.boundingBox())!.y - (await status.boundingBox())!.y),
  ).toBeLessThan(3);
  const today = new Date().toISOString().slice(0, 10);
  await start.fill(dateOnlyText(today));
  await end.fill(dateOnlyText(today));
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await status.selectOption("work_from_home");
  await expect(
    page.getByText("No Attendance Records", { exact: true }),
  ).toBeVisible();
  await status.selectOption("");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.screenshot({
    path: "../.tools/employee-attendance-toolbar.png",
    fullPage: true,
  });
});

test("admin navigation, employee creation, configuration and reports", async ({
  page,
}) => {
  await login(page, "admin");
  await expect(page.getByText("Loading your records…")).toHaveCount(0);
  await page.screenshot({
    path: "../.tools/admin-dashboard.png",
    fullPage: true,
  });
  for (const route of [
    "employees",
    "attendance",
    "shifts",
    "calendar",
    "settings",
  ]) {
    await page.goto(`/admin/${route}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByText("Loading your records…")).toHaveCount(0);
    await expect(page.locator("main .alert.error")).toHaveCount(0);
  }
  await page.goto("/admin/employees");
  await expect(
    page.getByRole("columnheader", { name: "Shift", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("tbody tr").filter({ hasText: "employee@example.com" }),
  ).toContainText("Isolated test shift · 8:00 AM – 5:00 PM");
  await page.getByRole("button", { name: "Add Employee" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full Name").fill("New browser test employee");
  await dialog.getByLabel("Corporate Email").fill("new@example.com");
  await expect(
    dialog
      .getByRole("combobox", { name: "Role", exact: true })
      .locator("option"),
  ).toHaveText(["Select Role", "Employee", "Admin", "Super Admin"]);
  await expect(
    dialog.getByRole("textbox", { name: "Employee ID", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByLabel("Date Of Joining (DOJ)", { exact: true })
    .fill("11-Oct-2026");
  await page.screenshot({
    path: "../.tools/employee-doj-create.png",
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Save Employee" }).click();
  await expect(
    page.getByRole("cell", { name: /New browser test employee/ }),
  ).toBeVisible();
  const createdRow = page
    .getByRole("row")
    .filter({ hasText: "New browser test employee" });
  await expect(createdRow).toContainText("2610-001");
  await expect(createdRow).toContainText("11-Oct-2026");
  await page.screenshot({
    path: "../.tools/employee-generated-id.png",
    fullPage: true,
  });
  await createdRow.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("2610-001");
  const employeePanel = page.getByRole("dialog");
  await expect(
    employeePanel.getByLabel("Effective from", { exact: true }),
  ).toHaveCount(0);
  await expect(
    employeePanel.getByLabel("Effective to (optional)", { exact: true }),
  ).toHaveCount(0);
  await expect(
    employeePanel.getByRole("button", {
      name: "Send Activation Link",
      exact: true,
    }),
  ).toBeEnabled();
  await expect(
    employeePanel.getByRole("button", { name: "Reset Password", exact: true }),
  ).toBeDisabled();
  await employeePanel
    .getByRole("button", { name: "Send Activation Link", exact: true })
    .click();
  await expect(employeePanel.getByRole("alert")).toContainText(
    "Email delivery is not configured",
  );
  await employeePanel
    .getByRole("combobox", { name: "Shift", exact: true })
    .selectOption({ label: "Isolated test shift" });
  await employeePanel
    .getByRole("button", { name: "Assign Shift", exact: true })
    .click();
  await expect(employeePanel).toContainText(
    "Latest assigned shift: Isolated test shift",
  );
  await employeePanel
    .getByRole("button", { name: "Assign Shift", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "../.tools/employee-shift-account-actions.png",
    fullPage: true,
  });

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close Panel", exact: true })
    .click();
  await page.getByRole("button", { name: "Add Employee" }).click();
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Role", exact: true })
    .selectOption("super_admin");
  await expect(
    page
      .getByRole("dialog")
      .getByLabel("Date Of Joining (DOJ)", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog").getByText(/Employee ID/)).toHaveCount(
    0,
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close Panel", exact: true })
    .click();
  await page
    .getByRole("row")
    .filter({ hasText: "employee@example.com" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Send Activation Link", exact: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Reset Password", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Reset Password", exact: true })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Email delivery is not configured",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close Panel", exact: true })
    .click();
  await page.goto("/admin/attendance");
  await expect(
    page.getByRole("link", { name: "Reports & analytics" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption({ label: "Employee" });
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("late");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toBe("attendance.csv");
  const csv = readFileSync((await exported.path())!, "utf8");
  expect(csv).toContain("employee@example.com");
  expect(csv).toContain(",late,");
  expect(csv).not.toContain("new@example.com");
  expect(csv.split("\n")[0]).toContain("Net Hours,Expected Hours,Late");
  expect(csv.split("\n")[0]).not.toMatch(/Corrected|Source|Minutes/);
  expect(csv).toContain("7h 36min,8h 0min");
  expect((await page.goto("/admin/reports"))?.status()).toBe(404);
});

test("employee activation chooses password and leading-zero PIN", async ({
  page,
}) => {
  const fixture = JSON.parse(
    readFileSync("../.tools/e2e-fixture.json", "utf8"),
  ) as { activation_token: string };
  await page.goto(`/activate#token=${fixture.activation_token}`);
  await page.getByLabel("Password", { exact: true }).fill("a");
  await expect(
    page.getByRole("status").filter({ hasText: "Password strength" }),
  ).toContainText("Weak");
  await page.getByLabel("Confirm Password", { exact: true }).fill("a");
  await page
    .getByLabel("Choose Your Six-Digit PIN", { exact: true })
    .fill("000001");
  await page.getByRole("button", { name: "Save Password and PIN" }).click();
  await expect(page.locator("main .alert.success")).toContainText(
    "Password and PIN saved",
  );
  await page.goto("/login/pin");
  await page.getByLabel("Company Email Address").fill("activate@example.com");
  await page.getByLabel("Your Six-Digit PIN", { exact: true }).fill("000001");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dashboard", exact: true }),
  ).toBeVisible();
});

test("local email recovery reports unavailable and keyboard focus is visible", async ({
  page,
}) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Company Email Address").fill("employee@example.com");
  await page
    .getByRole("button", { name: "Request Recovery Instructions" })
    .click();
  await expect(page.locator("main .alert.error")).toContainText(
    "Email recovery is unavailable",
  );
  await page.goto("/login");
  await page.keyboard.press("Tab");
  const outline = await page
    .locator(":focus")
    .evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).toBe("solid");
  await page.screenshot({
    path: "../.tools/login-desktop.png",
    fullPage: true,
  });
});

test("compact attendance filters work and requests are unavailable for both roles", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, "admin");
  await expect(
    page.getByRole("link", { name: "Requests & approvals" }),
  ).toHaveCount(0);
  await expect(page.getByText("Pending requests", { exact: true })).toHaveCount(
    0,
  );
  await page.goto("/admin/attendance");
  const filters = page.getByRole("region", { name: "Attendance Filters" });
  await expect(filters).toBeVisible();
  await expect(
    filters.getByRole("combobox", { name: "Department", exact: true }),
  ).toHaveCount(0);
  await expect(
    filters
      .getByRole("combobox", { name: "Status", exact: true })
      .locator("option:not([hidden])"),
  ).toHaveText(["Present", "Late", "Work From Home"]);
  const dateBox = filters.getByRole("textbox", {
    name: "Start Date",
    exact: true,
  });
  await expect(dateBox).toHaveCSS("border-top-style", "solid");
  expect((await filters.boundingBox())!.height).toBeLessThan(110);
  await expect(page.getByLabel("Start Date", { exact: true })).toBeVisible();
  await expect(page.getByLabel("End Date", { exact: true })).toBeVisible();
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await page
    .getByLabel("Start Date", { exact: true })
    .fill(dateOnlyText(tomorrow));
  await expect(filters.getByRole("alert")).toContainText(
    "Choose a start and end date in order",
  );
  await expect(page.getByLabel("End Date", { exact: true })).toBeVisible();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  await page
    .getByLabel("Start Date", { exact: true })
    .fill(dateOnlyText(yesterday));
  await page
    .getByLabel("End Date", { exact: true })
    .fill(dateOnlyText(yesterday));
  await expect(page.getByLabel("Start Date", { exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption({ label: "Employee" });
  await expect(page.locator("main")).toContainText("7h 36min");
  await expect(page.locator("main")).toContainText("8h 0min");
  await expect(page.locator("main")).toContainText(dateOnlyText(yesterday));
  await expect(
    page.getByRole("navigation", { name: "Record Pages" }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("present");
  await expect(
    page.getByText("No Attendance Records", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("late");
  await expect(page.locator("main")).toContainText("7h 36min");
  await expect(page.getByLabel("Start Date", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "../.tools/attendance-filters-desktop.png",
    fullPage: true,
  });
  const removed = await page.goto("/admin/requests");
  expect(removed?.status()).toBe(404);
  await login(page);
  await expect(
    page.getByRole("link", { name: "Requests & approvals" }),
  ).toHaveCount(0);
  const employeeRemoved = await page.goto("/employee/requests");
  expect(employeeRemoved?.status()).toBe(404);
  await page.goto("/employee/attendance");
  await expect(
    page
      .getByRole("combobox", { name: "Status", exact: true })
      .locator("option:not([hidden])"),
  ).toHaveText(["Present", "Late", "Work From Home"]);
  await login(page, "admin");
  await page.goto("/admin/employees");
  await expect(
    page.getByRole("heading", { name: "Departments", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Department", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "+ Add Employee" }).click();
  await expect(
    page.getByRole("combobox", { name: "Department", exact: true }),
  ).toHaveCount(0);
});

test("notes and security audit pages are retired for both workspaces", async ({
  page,
}) => {
  await login(page, "admin");
  await expect(
    page.getByRole("link", { name: "Security & audit" }),
  ).toHaveCount(0);
  expect((await page.goto("/admin/security"))?.status()).toBe(404);
  await login(page);
  await expect(page.getByRole("link", { name: "My notes" })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Notes for today" }),
  ).toHaveCount(0);
  expect((await page.goto("/employee/notes"))?.status()).toBe(404);
  await page.goto("/employee/calendar");
  await expect(page.getByText("Private notes for this day")).toHaveCount(0);
});

test("admin-only workspace and employee-scoped holiday/work-from-home calendar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(page.getByText(/Microsoft|SSO/i)).toHaveCount(0);
  await login(page, "admin");
  await expect(page.getByRole("link", { name: "My workspace" })).toHaveCount(0);
  await expect(
    page.locator("aside").getByRole("button", { name: "Sign Out" }),
  ).toHaveCount(0);
  await expect(
    page.locator("header").getByRole("button", { name: "Sign Out" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Punch In", exact: true }),
  ).toHaveCount(0);
  await page.goto("/employee/dashboard");
  await expect(page).toHaveURL(/admin\/dashboard/);
  await page.goto("/admin/settings");
  await expect(
    page.getByRole("heading", { name: "Integration readiness" }),
  ).toHaveCount(0);
  await expect(page.getByText(/Microsoft|SSO/i)).toHaveCount(0);
  await page.goto("/admin/calendar");
  const options = page.getByRole("region", {
    name: "Calendar Options",
    exact: true,
  });
  const calendar = page.getByRole("region", { name: "Calendar", exact: true });
  await expect(options).toBeVisible();
  await expect(options.getByText(/special working day/i)).toHaveCount(0);
  await expect(options.getByLabel("Day Type").locator("option")).toHaveText([
    "Holiday",
    "Work From Home",
    "Optional holiday (working day)",
  ]);
  const left = (await options.boundingBox())!,
    right = (await calendar.boundingBox())!;
  expect(left.x + left.width).toBeLessThan(right.x);
  expect(Math.abs(left.width - right.width)).toBeLessThan(2);
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  await options
    .getByLabel("Date", { exact: true })
    .fill(dateOnlyText(tomorrow));
  await options
    .getByLabel("Description (Optional)")
    .fill("Organization holiday");
  await options.getByRole("button", { name: "Save Calendar Day" }).click();
  await expect(
    calendar.getByRole("button", {
      name: "Select " + dateOnlyText(tomorrow),
      exact: true,
    }),
  ).toContainText("Holiday");
  await options
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption({ label: "Employee" });
  await options.getByLabel("Day Type").selectOption("work_from_home");
  await options
    .getByLabel("Description (Optional)")
    .fill("Individual remote day");
  await options.getByRole("button", { name: "Save Calendar Day" }).click();
  await expect(
    calendar.getByRole("button", {
      name: "Select " + dateOnlyText(tomorrow),
      exact: true,
    }),
  ).toContainText("Work From Home");
  await options
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption("");
  await options.getByLabel("Day Type").selectOption("work_from_home");
  await options.getByRole("button", { name: "Save Calendar Day" }).click();
  await expect(
    options.getByText("Organization holiday", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../.tools/calendar-admin-desktop.png",
    fullPage: true,
  });
  await options.getByLabel("Date", { exact: true }).fill(dateOnlyText(today));
  await options
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption({ label: "Employee" });
  await options.getByLabel("Day Type").selectOption("work_from_home");
  await options.getByRole("button", { name: "Save Calendar Day" }).click();
  await expect(page.locator("main .alert.success")).toContainText(
    "Calendar updated",
  );
  await page.goto("/admin/attendance");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("work_from_home");
  await page
    .getByRole("combobox", { name: "Employee", exact: true })
    .selectOption({ label: "Employee" });
  await expect(page.locator("tbody .badge")).toHaveText("Work From Home");
  await login(page);
  await expect(
    page.getByText("Work From Home is recorded for today.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Punch In", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Punch Out", exact: true }),
  ).toHaveCount(0);
  await page.goto("/employee/attendance");
  await page
    .getByRole("combobox", { name: "Status", exact: true })
    .selectOption("work_from_home");
  await expect(page.locator("tbody .badge")).toHaveText("Work From Home");
  await page.goto("/employee/notifications");
  await expect(
    page.getByText(/Work From Home scheduled for you/).first(),
  ).toBeVisible();
  await page.goto("/employee/profile");
  await expect(page.getByText(/Microsoft|SSO/i)).toHaveCount(0);
});

test("compact desktop calendar shows holiday dots and all-day hover details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await login(page, "admin");
  await page.goto("/admin/calendar");
  const options = page.getByRole("region", {
    name: "Calendar Options",
    exact: true,
  });
  const calendar = page.getByRole("region", { name: "Calendar", exact: true });
  const clock = await page.evaluate(async () =>
    (
      await fetch("http://localhost:8000/api/v1/time", {
        credentials: "include",
      })
    ).json(),
  );
  const currentDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: clock.timezone,
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(clock.instant));
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(
    currentDate,
  );
  const today = new Intl.DateTimeFormat("en-GB", {
    timeZone: clock.timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date(clock.instant))
    .replaceAll(" ", "-");
  await expect(
    calendar.getByRole("button", { name: `Select ${today}`, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  await expect(
    calendar.getByRole("button", { name: "Today", exact: true }),
  ).toHaveCount(0);
  await expect(
    calendar.getByRole("group", { name: "Calendar View" }),
  ).toHaveCount(0);
  await calendar.getByRole("button", { name: "Previous Month" }).click();
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(
    "September 2026",
  );
  await calendar.getByRole("button", { name: "Next Month" }).click();
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(
    "October 2026",
  );
  await options.getByLabel("Date", { exact: true }).fill("21-Oct-2026");
  await options
    .getByLabel("Description (Optional)")
    .fill("Vijaya Dashami / Dussehra");
  await options.getByRole("button", { name: "Save Calendar Day" }).click();
  const holiday = calendar.getByRole("button", {
    name: "Select 21-Oct-2026",
    exact: true,
  });
  await expect(holiday.locator(".calendar-dot.holiday")).toBeVisible();
  await holiday.click();
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(
    "21 October 2026",
  );
  await holiday.hover();
  await expect(holiday.getByRole("tooltip")).toContainText(
    "Vijaya Dashami / Dussehra",
  );
  await expect(holiday.getByRole("tooltip")).toContainText("All day");
  await expect(holiday.getByRole("tooltip")).toContainText("Office calendar");
  await holiday.focus();
  await expect(holiday.getByRole("tooltip")).toBeVisible();
  await options.getByLabel("Date", { exact: true }).fill("22-Oct-2026");
  await options.getByLabel("Day Type").selectOption("optional_holiday");
  await options
    .getByLabel("Description (Optional)")
    .fill("Optional test working day");
  await options.getByRole("button", { name: "Save Calendar Day" }).click();
  const optional = calendar.getByRole("button", {
    name: "Select 22-Oct-2026",
    exact: true,
  });
  await expect(
    optional.locator(".calendar-dot.optional_holiday"),
  ).toBeVisible();
  await optional.click();
  await expect(calendar.getByRole("heading", { level: 2 })).toHaveText(
    "22 October 2026",
  );
  await optional.hover();
  await expect(optional.getByRole("tooltip")).toContainText(
    "Optional holiday (working day)",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "../.tools/calendar-compact-desktop.png",
    fullPage: true,
  });
});

test("employee calendar leaves weekly offs unmarked", async ({ page }) => {
  await login(page, "admin");
  const original = await page.evaluate(async () => {
    const api = "http://localhost:8000/api/v1";
    const session = await (
      await fetch(`${api}/auth/session`, { credentials: "include" })
    ).json();
    const settings = await (
      await fetch(`${api}/settings`, { credentials: "include" })
    ).json();
    const response = await fetch(`${api}/settings`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": session.csrf,
      },
      body: JSON.stringify({
        ...settings.policy,
        name: settings.name,
        timezone: settings.timezone,
        weekly_off: [0, 1, 2, 3, 4, 5, 6],
        reason: "Isolated calendar display check",
      }),
    });
    if (!response.ok)
      throw new Error("Could not configure isolated weekly offs");
    return settings;
  });
  try {
    await login(page);
    const loaded = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/me/calendar?") && response.ok(),
    );
    await page.goto("/employee/calendar");
    const calendar = await (await loaded).json();
    const off = calendar.attendance.find(
      (row: { status: string; local_date: string }) =>
        row.status === "weekly_off",
    );
    expect(off).toBeTruthy();
    const cell = page.getByRole("button", {
      name: "Select " + dateOnlyText(off.local_date),
      exact: true,
    });
    await expect(cell.locator(".calendar-dot")).toHaveCount(0);
    await cell.click();
    const details = page.getByRole("region", {
      name: "Calendar Options",
      exact: true,
    });
    await expect(details).not.toContainText(/weekly off|work from home|worked/);
    await expect(details.locator("dd")).toHaveText([
      "Not Punched In",
      "Not Punched Out",
    ]);
  } finally {
    await login(page, "admin");
    const status = await page.evaluate(async (original) => {
      const api = "http://localhost:8000/api/v1";
      const session = await (
        await fetch(`${api}/auth/session`, { credentials: "include" })
      ).json();
      return (
        await fetch(`${api}/settings`, {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrf,
          },
          body: JSON.stringify({
            ...original.policy,
            name: original.name,
            timezone: original.timezone,
            reason: "Restore isolated test settings",
          }),
        })
      ).status;
    }, original);
    expect(status).toBe(200);
  }
});

test("Admin has the same account and settings controls as Super Admin", async ({
  page,
}) => {
  await login(page, "administrator");
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
  await expect(page.locator(".topbar .badge")).toHaveText("Admin");
  await page
    .getByRole("link", { name: "System Settings", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "System Settings",
  );
  await expect(page.getByLabel("Organization Name")).toBeVisible();
  await page
    .getByRole("link", { name: "Employee Management", exact: true })
    .click();
  await page
    .getByRole("button", { name: "+ Add Employee", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Role").locator("option")).toHaveText([
    "Select Role",
    "Employee",
    "Admin",
    "Super Admin",
  ]);
  for (const role of ["admin", "super_admin"]) {
    await dialog.getByLabel("Role").selectOption(role);
    await expect(dialog.getByLabel("Date Of Joining (DOJ)")).toHaveCount(0);
  }
  await dialog.getByLabel("Full Name").fill("Admin-created administrator");
  await dialog
    .getByLabel("Corporate Email")
    .fill("created-by-admin@example.com");
  await dialog.getByLabel("Role").selectOption("admin");
  await dialog
    .getByRole("button", { name: "Save Employee", exact: true })
    .click();
  const row = page
    .getByRole("row")
    .filter({ hasText: "created-by-admin@example.com" });
  await expect(row).toContainText("Admin-created administrator");
  await expect(
    row.getByRole("cell", { name: "Admin", exact: true }),
  ).toBeVisible();
});

test("sign-in method switches are instant and retain email", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Company Email Address").fill("navigation@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-carried-over");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.locator(".route-loading")).toHaveCount(0);
  await page.getByRole("link", { name: "Use PIN", exact: true }).click();
  await expect(page.locator(".route-loading")).toHaveCount(0);
  await expect(page).toHaveURL(/\/login\/pin$/);
  await expect(page.locator(".route-loading")).toHaveCount(0);
  await expect(page.getByLabel("Company Email Address")).toHaveValue(
    "navigation@example.com",
  );
  await expect(
    page.getByLabel("Your Six-Digit PIN", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("link", { name: "Back To Password Sign In" }).click();
  await expect(page.locator(".route-loading")).toHaveCount(0);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator(".route-loading")).toHaveCount(0);
  await expect(page.getByLabel("Company Email Address")).toHaveValue(
    "navigation@example.com",
  );
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("");
});
