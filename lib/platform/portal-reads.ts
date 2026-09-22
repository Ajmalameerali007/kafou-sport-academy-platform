import { z } from "zod";
import { databaseError, type sessionClient } from "./server";
import type { Json } from "./database.types";
export async function readPortal(
  db: Awaited<ReturnType<typeof sessionClient>>,
  resource: string,
  p: URLSearchParams,
) {
  const id = (key: string) => z.string().uuid().nullable().parse(p.get(key));
  const offset = z.coerce
    .number()
    .int()
    .min(0)
    .max(100000)
    .parse(p.get("offset") || 0);
  const query = z
    .string()
    .max(100)
    .parse(p.get("q") || "");
  let name: string;
  let args: Record<string, Json>;
  switch (resource) {
    case "authority":
      name = "portal_authority";
      args = {};
      break;
    case "revision":
      name = "portal_revision";
      args = { p_branch: id("branch") };
      break;
    case "memberships":
      name = "portal_memberships";
      args = {
        p_child: id("child"),
        p_history: p.get("history") === "true",
        p_offset: offset,
      };
      break;
    case "children":
      name = "portal_children";
      args = { p_child: id("child"), p_offset: offset };
      break;
    case "packages":
      name = "portal_packages";
      args = {
        p_query: query,
        p_branch: id("branch"),
        p_offset: offset,
        p_id: id("id"),
      };
      break;
    case "package-branches":
      name = "portal_package_branches";
      args = {
        p_id: id("id"),
        p_sport: z
          .enum(["swimming", "football", "karate", "badminton"])
          .parse(p.get("sport")),
        p_query: query,
        p_offset: offset,
      };
      break;
    case "calendar":
      name = "portal_calendar";
      args = {
        p_from: z.string().date().parse(p.get("from")),
        p_to: z.string().date().parse(p.get("to")),
        p_branch: id("branch"),
        p_query: query,
        p_offset: offset,
      };
      break;
    default:
      throw new Error("Unknown portal projection");
  }
  // Narrow bridge for additive RPCs; existing generated schema is preserved.
  const rpc = db as unknown as {
    rpc(
      name: string,
      args: Record<string, Json>,
    ): PromiseLike<{
      data: unknown;
      error: { code?: string; message?: string } | null;
    }>;
  };
  const r = await rpc.rpc(name, args);
  if (r.error) throw databaseError(r.error);
  return r.data;
}
