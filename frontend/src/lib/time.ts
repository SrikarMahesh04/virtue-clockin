/** Display times independently of the device's 12/24-hour preference. */
export const shortMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function dateOnlyText(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return value || "—";
  return `${match[3]}-${shortMonths[Number(match[2]) - 1]}-${match[1]}`;
}

export function parseDate(value: string) {
  const match = value.trim().match(/^(\d{2})-([a-z]{3})-(\d{4})$/i);
  if (!match) return "";
  const month = shortMonths.findIndex(
    (m) => m.toLowerCase() === match[2].toLowerCase(),
  );
  if (month < 0) return "";
  const iso = `${match[3]}-${String(month + 1).padStart(2, "0")}-${match[1]}`;
  const instant = new Date(iso + "T12:00:00Z");
  return Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === iso
    ? iso
    : "";
}

export function durationText(minutes: number) {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export function timeText(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}
