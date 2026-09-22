import { isLocalDemoRuntime } from "./local-demo";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import type { AccountContext } from "./contracts";
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function config() {
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new AppError(
      "unavailable",
      "The account service is temporarily unavailable.",
      503,
    );
  return { url, key, origin: process.env.APP_URL || "http://localhost:3100" };
}
export async function sessionClient(remember?: boolean) {
  const { url, key, origin } = config();
  const jar = await cookies();
  const persistent = remember ?? jar.get("kafou-remember")?.value === "yes";
  if (remember !== undefined)
    jar.set("kafou-remember", remember ? "yes" : "no", {
      httpOnly: true,
      secure: origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
      ...(remember ? { maxAge: 2592000 } : {}),
    });
  return createServerClient<Database>(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: origin.startsWith("https:"),
      sameSite: "lax",
      path: "/",
      ...(!persistent ? { maxAge: undefined } : {}),
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(items) {
        for (const item of items) {
          try {
            jar.set(item.name, item.value, {
              ...item.options,
              httpOnly: true,
              secure: origin.startsWith("https:"),
              sameSite: "lax",
              ...(!persistent && item.options.maxAge !== 0
                ? { maxAge: undefined, expires: undefined }
                : {}),
            });
          } catch {
            /* Server-rendered reads refresh through /api/auth/session. */
          }
        }
      },
    },
  });
}
export function privilegedClient() {
  const { url } = config();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret)
    throw new AppError(
      "unavailable",
      "The service is not configured yet.",
      503,
    );
  return createClient<Database>(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function context(
  client?: Awaited<ReturnType<typeof sessionClient>>,
) {
  const db = client || (await sessionClient());
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user)
    throw new AppError("unauthenticated", "Please sign in to continue.", 401);
  const { data, error: contextError } = await db.rpc("account_context");
  if (contextError || !data)
    throw new AppError("forbidden", "This account has no academy access.", 403);
  const account = data as unknown as AccountContext;
  account.localDemoMfaExempt =
    account.localDemoMfaExempt === true &&
    isLocalDemoRuntime(process.env.SUPABASE_URL, process.env.APP_URL);
  if (!account.active)
    throw new AppError(
      "forbidden",
      "This account is suspended. Contact the academy.",
      403,
    );
  return { db, user, account };
}
export function databaseError(error: { code?: string; message?: string }) {
  const code = error.code;
  if (code === "P0429")
    return new AppError(
      "rate_limited",
      "Too many attempts. Please try again later.",
      429,
    );
  if (code === "42501")
    return new AppError(
      "forbidden",
      "You do not have permission for this action.",
      403,
    );
  if (code === "P0409")
    return new AppError(
      "conflict",
      "This operation is no longer available. Refresh to check eligibility, capacity and status.",
      409,
    );
  if (code === "23505")
    return new AppError(
      "conflict",
      "This record or request already exists. Refresh and try again.",
      409,
    );
  if (code === "P0002")
    return new AppError(
      "not_found",
      "The record was not found or is unchanged.",
      404,
    );
  if (code?.startsWith("22") || code?.startsWith("23"))
    return new AppError(
      "validation",
      "Check the information and try again.",
      400,
    );
  return new AppError(
    "unavailable",
    "The service could not complete this request. Please try again.",
    503,
  );
}
export async function limit(request: Request, scope: string, max = 20) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret)
    throw new AppError(
      "unavailable",
      "The service is not configured yet.",
      503,
    );
  const ip = request.headers.get("cf-connecting-ip") || "local";
  const bytes = new TextEncoder().encode(`${secret}:${scope}:${ip}`);
  const digest = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
  const { data, error } = await privilegedClient().rpc("consume_rate_limit", {
    p_key: digest,
    p_limit: max,
    p_seconds: 900,
  });
  if (error) throw databaseError(error);
  if (!data)
    throw new AppError(
      "rate_limited",
      "Too many attempts. Please try again later.",
      429,
    );
}
export function checkOrigin(request: Request) {
  const allowed = new URL(config().origin).origin;
  const origin = request.headers.get("origin");
  if (
    origin !== allowed &&
    !(
      process.env.NODE_ENV !== "production" &&
      ["http://localhost:3100", "http://127.0.0.1:3101"].includes(origin || "")
    )
  )
    throw new AppError("forbidden", "This request is not allowed.", 403);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("validation", "JSON is required.", 415);
}
export async function input(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 24000)
    throw new AppError("validation", "Request is too large.", 413);
  const body = await request.text();
  if (body.length > 24000)
    throw new AppError("validation", "Request is too large.", 413);
  try {
    return JSON.parse(body);
  } catch {
    throw new AppError("validation", "Invalid request.", 400);
  }
}
export function ok(data: unknown) {
  return Response.json(
    { ok: true, data },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export function failure(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : new AppError(
          "unavailable",
          "The service could not complete this request.",
          503,
        );
  return Response.json(
    { ok: false, code: e.code, message: e.message },
    { status: e.status, headers: { "Cache-Control": "private, no-store" } },
  );
}
