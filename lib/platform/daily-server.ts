import { z } from "zod";
import { dailyCommandSchema } from "./daily-operations";
import { AppError, databaseError, type sessionClient } from "./server";
import type { Json } from "./database.types";
async function rpc(
  db: Awaited<ReturnType<typeof sessionClient>>,
  name: string,
  args: Record<string, Json>,
) {
  const r = await (
    db as unknown as {
      rpc: (
        n: string,
        a: Record<string, Json>,
      ) => PromiseLike<{
        data: unknown;
        error: { code?: string; message?: string } | null;
      }>;
    }
  ).rpc(name, args);
  if (r.error) {
    if (["P0409", "22023"].includes(r.error.code || ""))
      throw new AppError(
        r.error.code === "P0409" ? "conflict" : "validation",
        r.error.message || "Review this action",
        r.error.code === "P0409" ? 409 : 400,
      );
    throw databaseError(r.error);
  }
  return r.data;
}
export async function dailyRead(
  db: Awaited<ReturnType<typeof sessionClient>>,
  p: URLSearchParams,
) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
  }).format(new Date());
  return rpc(db, "daily_read", {
    p_view: z
      .enum([
        "today",
        "session",
        "shifts",
        "expenses",
        "salary",
        "agreements",
        "employees",
      ])
      .parse(p.get("view") || "today"),
    p_branch: z.string().uuid().nullable().parse(p.get("branch")),
    p_from: z
      .string()
      .date()
      .parse(p.get("from") || day),
    p_to: z
      .string()
      .date()
      .parse(p.get("to") || day),
    p_offset: z.coerce
      .number()
      .int()
      .min(0)
      .max(100000)
      .parse(p.get("offset") || 0),
    p_query: z
      .string()
      .max(100)
      .parse(p.get("q") || ""),
    p_id: z.string().uuid().nullable().parse(p.get("id")),
  });
}
export async function dailyWrite(
  db: Awaited<ReturnType<typeof sessionClient>>,
  v: unknown,
) {
  const x = dailyCommandSchema.parse(v);
  return rpc(db, "daily_command", {
    p_action: x.action,
    p_data: x.data as Json,
    p_key: x.key,
  });
}
