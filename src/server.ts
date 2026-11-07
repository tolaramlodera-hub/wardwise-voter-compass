import * as Sentry from "@sentry/node";
import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

// The DSN is a public ingestion endpoint, not an authentication secret.
// Keep this initialized in the server bundle so SSR/function failures are captured.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.user) delete event.user;
      return event;
    },
  });
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 can swallow handler throws into a normal 500 Response. Recover and report
// the original error captured by error-capture.ts before returning the safe page.
async function normalizeCatastrophicSsrResponse(response: Response, request: Request): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const error = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  Sentry.captureException(error, {
    tags: { source: "ssr", route: new URL(request.url).pathname },
    extra: { method: request.method, status: response.status },
  });
  await Sentry.flush(2000);
  console.error(error);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

async function handleAdminSentryTest(request: Request): Promise<Response> {
  const json = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Forbidden origin" }, 403);

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!accessToken || !supabaseUrl || !supabaseKey) return json({ error: "Authentication required" }, 401);

  try {
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, authorization: `Bearer ${accessToken}` },
    });
    if (!authResponse.ok) return json({ error: "Valid login required" }, 401);
    const user = await authResponse.json() as { id?: string };
    if (!user.id) return json({ error: "Valid login required" }, 401);

    const profileUrl = new URL(`${supabaseUrl}/rest/v1/profiles`);
    profileUrl.searchParams.set("select", "role,is_active");
    profileUrl.searchParams.set("user_id", `eq.${user.id}`);
    profileUrl.searchParams.set("limit", "1");
    const profileResponse = await fetch(profileUrl, {
      headers: { apikey: supabaseKey, authorization: `Bearer ${accessToken}` },
    });
    if (!profileResponse.ok) return json({ error: "Admin authorization could not be verified" }, 403);
    const profiles = await profileResponse.json() as Array<{ role?: string; is_active?: boolean }>;
    if (profiles[0]?.role !== "admin" || profiles[0]?.is_active !== true) {
      return json({ error: "Admin access required" }, 403);
    }

    Sentry.captureMessage("Wardwise server Sentry integration test", {
      level: "error",
      tags: { source: "website-health-server-test", test_event: "true" },
      extra: { purpose: "Admin-triggered server delivery verification" },
    });
    const delivered = await Sentry.flush(5000);
    if (!delivered) return json({ error: "Sentry queue flush was not confirmed" }, 502);
    return json({ ok: true, message: "Server test event sent to Sentry" });
  } catch (error) {
    console.error("Admin Sentry test endpoint failed:", error);
    return json({ error: "Server test could not be completed" }, 500);
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    if (new URL(request.url).pathname === "/api/admin/sentry-test") return handleAdminSentryTest(request);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response, request);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { source: "server", route: new URL(request.url).pathname },
        extra: { method: request.method },
      });
      await Sentry.flush(2000);
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
