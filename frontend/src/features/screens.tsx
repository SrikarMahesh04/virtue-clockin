"use client";
import { AdminAttendance, AdminDashboard, Employees, Shifts } from "./admin";
import { SystemSettings } from "./administration";
import { Calendar } from "./calendar";
import {
  EmployeeAttendance,
  EmployeeDashboard,
  Notifications,
  Profile,
} from "./employee";

export function Screen({
  area,
  screen,
}: {
  area: "employee" | "admin";
  screen: string;
}) {
  if (area === "employee") {
    switch (screen) {
      case "dashboard":
        return <EmployeeDashboard />;
      case "attendance":
        return <EmployeeAttendance />;
      case "calendar":
        return <Calendar />;
      case "notifications":
        return <Notifications />;
      case "profile":
        return <Profile />;
    }
  }
  switch (screen) {
    case "dashboard":
      return <AdminDashboard />;
    case "employees":
      return <Employees />;
    case "attendance":
      return <AdminAttendance />;
    case "shifts":
      return <Shifts />;
    case "calendar":
      return <Calendar admin />;
    case "settings":
      return <SystemSettings />;
  }
  return null;
}
