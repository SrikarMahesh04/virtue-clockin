import createClient from "openapi-fetch";
import type { paths, components } from "@/generated/schema";
import { resolveApiUrl } from "./api-url";

export type Models = components["schemas"];
export const API_URL = resolveApiUrl(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  typeof window === "undefined" ? undefined : window.location.origin,
);
export const api = createClient<paths>({
  baseUrl: API_URL,
  credentials: "include",
});
let csrf = "";
export function setCsrf(value: string) {
  csrf = value;
}
api.use({
  onRequest({ request }) {
    if (csrf) request.headers.set("X-CSRF-Token", csrf);
    return request;
  },
});

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}
export function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Try again.";
}
export async function result<T>(
  promise: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  let output;
  try {
    output = await promise;
  } catch {
    throw new ApiError(
      "API_UNAVAILABLE",
      "Cannot reach the API. Check that the backend is running.",
    );
  }
  if (output.error || !output.response.ok) {
    const value = output.error as
      | {
          error?: {
            code?: string;
            message?: string;
            details?: { field: string; message: string }[];
          };
        }
      | undefined;
    const details = value?.error?.details
      ?.map((d) => `${d.field}: ${d.message}`)
      .join("; ");
    throw new ApiError(
      value?.error?.code || "API_ERROR",
      (value?.error?.message || "Request failed") +
        (details ? ` — ${details}` : ""),
      output.response.status,
    );
  }
  return output.data as T;
}
