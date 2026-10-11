function localHostname(hostname: string): boolean {
  if (
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname) ||
    hostname.endsWith(".local")
  )
    return true;
  const parts = hostname.split(".").map(Number);
  return (
    parts.length === 4 &&
    parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) &&
    (parts[0] === 10 ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31))
  );
}

/** A phone must call the development computer, never the phone's localhost. */
export function resolveApiUrl(
  configured: string | undefined,
  browserOrigin?: string,
): string {
  const target = new URL(configured || "http://localhost:8000");
  if (browserOrigin) {
    const browser = new URL(browserOrigin);
    const loopback = new Set(["localhost", "127.0.0.1"]);
    if (localHostname(browser.hostname) && loopback.has(target.hostname)) {
      target.hostname = browser.hostname;
      target.protocol = browser.protocol;
    }
  }
  return target.toString().replace(/\/$/, "");
}
