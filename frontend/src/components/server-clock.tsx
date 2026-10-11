"use client";
import { useEffect, useState } from "react";
import { api, result } from "@/services/api";

export function ServerClock() {
  const [clock, setClock] = useState("Synchronising time…");
  useEffect(() => {
    let active = true;
    let sample: { instant: number; elapsed: number; zone: string } | undefined;
    let pending = false;
    async function sync() {
      if (pending) return;
      pending = true;
      const started = performance.now();
      try {
        const value = await result(
          api.GET("/api/v1/time", { cache: "no-store" }),
        );
        const elapsed = performance.now();
        if (active)
          sample = {
            instant: Date.parse(value.instant) + (elapsed - started) / 2,
            elapsed,
            zone: value.timezone,
          };
      } catch {
        // Never substitute the device's wall clock if synchronisation fails.
      } finally {
        pending = false;
      }
      update();
    }
    function update() {
      if (!active) return;
      if (!sample || performance.now() - sample.elapsed > 120_000) {
        setClock("Time unavailable");
        return;
      }
      setClock(
        new Intl.DateTimeFormat("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
          timeZone: sample.zone,
        }).format(
          new Date(sample.instant + performance.now() - sample.elapsed),
        ),
      );
    }
    void sync();
    const tick = setInterval(update, 1000);
    const resync = setInterval(() => void sync(), 60_000);
    const resume = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearInterval(tick);
      clearInterval(resync);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  return (
    <span
      className="muted"
      aria-label="Office Time"
      title="Synchronised With The Attendance Server"
    >
      {clock}
    </span>
  );
}
