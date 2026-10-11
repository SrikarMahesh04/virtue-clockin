/* global Netlify */

const requestHeaders = [
  "accept",
  "content-type",
  "cookie",
  "origin",
  "x-csrf-token",
];
const responseHeaders = [
  "content-type",
  "content-disposition",
  "x-request-id",
  "retry-after",
];

function unavailable(code, message, status = 503) {
  return Response.json(
    { error: { code, message, details: [] } },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export default async function proxy(request, context) {
  const backend = Netlify.env.get("CLOCKIN_BACKEND_ORIGIN");
  const secret = Netlify.env.get("CLOCKIN_PROXY_SECRET");
  if (!backend || !secret || secret.length < 32) {
    return unavailable(
      "CONFIGURATION_REQUIRED",
      "The hosted API is not configured yet.",
    );
  }

  const incoming = new URL(request.url);
  let target;
  try {
    target = new URL(backend);
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      target.pathname !== "/" ||
      target.search ||
      target.hash ||
      target.origin === incoming.origin
    )
      throw new Error("Invalid API origin");
  } catch {
    return unavailable(
      "CONFIGURATION_REQUIRED",
      "The hosted API address is invalid.",
    );
  }
  if (!context.ip) {
    return unavailable(
      "NETWORK_UNAVAILABLE",
      "Visitor network verification is unavailable.",
    );
  }
  if (
    !["GET", "HEAD", "POST", "PUT", "DELETE", "OPTIONS"].includes(
      request.method,
    )
  ) {
    return unavailable(
      "METHOD_NOT_ALLOWED",
      "This request method is not supported.",
      405,
    );
  }

  // Copy only expected headers. Visitor-supplied proxy/IP headers are discarded.
  const headers = new Headers();
  for (const name of requestHeaders) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-ClockIn-Proxy-Secret", secret);
  headers.set("X-ClockIn-Client-IP", context.ip);
  target.pathname = incoming.pathname;
  target.search = incoming.search;

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    const outgoing = new Headers({ "cache-control": "no-store" });
    for (const name of responseHeaders) {
      const value = upstream.headers.get(name);
      if (value) outgoing.set(name, value);
    }
    for (const cookie of upstream.headers.getSetCookie()) {
      outgoing.append("set-cookie", cookie);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: outgoing,
    });
  } catch {
    // Do not log request bodies, cookies, headers, tokens or the private secret.
    return unavailable(
      "API_UNAVAILABLE",
      "The hosted API is unavailable. Try again shortly.",
      502,
    );
  }
}
