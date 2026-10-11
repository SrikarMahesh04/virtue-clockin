import { describe, it, expect } from "vitest";
import { resolveApiUrl } from "./api-url";

describe("API connection hostname", () => {
  it.each(["localhost", "127.0.0.1"])(
    "uses %s for local browser requests",
    (host) => {
      expect(
        resolveApiUrl("http://localhost:8000", `http://${host}:3000`),
      ).toBe(`http://${host}:8000`);
      expect(
        resolveApiUrl("http://127.0.0.1:8123/api", `http://${host}:3000`),
      ).toBe(`http://${host}:8123/api`);
    },
  );
  it("preserves remote API URLs and server-side defaults", () => {
    expect(
      resolveApiUrl("https://api.example.com", "http://127.0.0.1:3000"),
    ).toBe("https://api.example.com");
    expect(
      resolveApiUrl("http://localhost:8000", "https://clockin.example.com"),
    ).toBe("http://localhost:8000");
    expect(resolveApiUrl(undefined)).toBe("http://localhost:8000");
  });
  it.each(["192.168.88.8", "10.0.0.5", "172.16.0.5", "clockin.local"])(
    "uses computer address %s from a phone",
    (host) => {
      expect(
        resolveApiUrl("http://localhost:8000", `http://${host}:3000`),
      ).toBe(`http://${host}:8000`);
      expect(
        resolveApiUrl("http://localhost:8000", `https://${host}:3000`),
      ).toBe(`https://${host}:8000`);
    },
  );
  it("preserves explicitly configured remote endpoints when browsing on a phone", () => {
    expect(
      resolveApiUrl("https://api.example.com", "http://192.168.88.8:3000"),
    ).toBe("https://api.example.com");
  });
});
