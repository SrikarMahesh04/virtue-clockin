"use client";
import { useCallback } from "react";
import { api, Models, result } from "@/services/api";
import { Badge, Field } from "@/components/ui";
import { OfficeLocationPicker } from "@/components/office-location-picker";
import { LoadState, useApp, useLoad } from "./shell";

export function SystemSettings() {
  const loader = useCallback(() => result(api.GET("/api/v1/settings")), []);
  const { data, loading, error } = useLoad(loader),
    { act, busy } = useApp();
  if (!data) return <LoadState loading={loading} error={error} />;
  const policy = data.policy;
  const value = (key: string) =>
    typeof policy[key] === "number" ? Number(policy[key]) : "";
  const weekly = Array.isArray(policy.weekly_off) ? policy.weekly_off : [5, 6];
  return (
    <div className="stack">
      <section className="card">
        <div className="row spread">
          <h2>Organization & Office Verification</h2>
          <Badge
            value={data.configured ? "configured" : "configuration required"}
          />
        </div>
        <form
          key={JSON.stringify(data.policy) + data.name}
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const body: Models["OfficePolicy"] = {
              name: String(f.get("name")),
              timezone: String(f.get("timezone")),
              latitude: Number(f.get("lat")),
              longitude: Number(f.get("lon")),
              radius_m: Number(f.get("radius")),
              max_accuracy_m: Number(f.get("accuracy")),
              approved_networks: ["0.0.0.0/0"],
              weekly_off: f.getAll("off").map(Number),
              reason: "Updated via UI",
            };
            void act(() => {
              if (f.get("lat") === "" || f.get("lon") === "")
                throw new Error(
                  "Select your office location on Google Maps before saving.",
                );
              return result(api.PUT("/api/v1/settings", { body }));
            }, "Organization settings saved");
          }}
        >
          <div className="form-grid">
            <Field label="Organization Name">
              <input name="name" defaultValue={data.name || ""} required />
            </Field>
            <Field label="Office IANA Timezone">
              <input
                name="timezone"
                defaultValue={data.timezone || ""}
                required
                aria-describedby="timezone-help"
              />
            </Field>
            <Field label="Maximum Accepted Location Accuracy (Meters)">
              <input
                name="accuracy"
                type="number"
                min={1}
                max={5000}
                defaultValue={value("max_accuracy_m")}
                required
              />
            </Field>
          </div>
          <small id="timezone-help">
            Use The Office’S Actual Timezone. All Attendance Dates And Monthly
            Late Counts Follow It.
          </small>
          <OfficeLocationPicker
            latitude={
              value("latitude") === "" ? undefined : Number(value("latitude"))
            }
            longitude={
              value("longitude") === "" ? undefined : Number(value("longitude"))
            }
            radius={
              value("radius_m") === "" ? undefined : Number(value("radius_m"))
            }
          />

          <div>
            <h3>Weekly Off</h3>
            <div className="row">
              {[
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday",
              ].map((day, i) => (
                <label className="row" key={day}>
                  <input
                    type="checkbox"
                    name="off"
                    value={i}
                    defaultChecked={weekly.includes(i)}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
          <button className="primary" disabled={busy}>
            Save Office Configuration
          </button>
        </form>
      </section>
    </div>
  );
}
