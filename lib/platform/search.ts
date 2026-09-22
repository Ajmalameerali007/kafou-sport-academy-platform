import { z } from "zod";
import { api } from "./client";
import type { ServiceResult } from "../kafou/types";

export const searchKinds = [
  "family",
  "child",
  "lead",
  "class",
  "trial",
  "session",
] as const;
export type SearchKind = (typeof searchKinds)[number];
const cursor = z
  .string()
  .regex(
    /^(family|child|lead|class|trial|session):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
export const searchRequestSchema = z.object({
  query: z.string().trim().min(2).max(80),
  kinds: z
    .array(z.enum(searchKinds))
    .min(1)
    .max(6)
    .default([...searchKinds]),
  after: cursor.optional(),
  limit: z.number().int().min(1).max(50).default(20),
  branch: z.string().uuid().optional(),
  child: z.string().uuid().optional(),
});
export type SearchRequest = z.input<typeof searchRequestSchema>;
export const searchResponseSchema = z.object({
  items: z
    .array(
      z.object({
        id: cursor,
        kind: z.enum(["Family", "Child", "Lead", "Class", "Trial", "Session"]),
        title: z.string(),
        detail: z.string(),
        section: z.enum([
          "Families",
          "Enquiries",
          "Classes / Sessions",
          "Trials",
          "Assigned sessions",
        ]),
        record: z.string().uuid(),
      }),
    )
    .max(50),
  total: z.number().int().nonnegative(),
  next_cursor: cursor.nullable(),
});
export type SearchPage = z.infer<typeof searchResponseSchema>;
export async function workspaceSearch(
  input: SearchRequest,
): Promise<ServiceResult<SearchPage>> {
  const parsed = searchRequestSchema.parse(input);
  const params = new URLSearchParams({
    q: parsed.query,
    kinds: parsed.kinds.join(","),
    limit: String(parsed.limit),
  });
  if (parsed.after) params.set("after", parsed.after);
  if (parsed.branch) params.set("branch", parsed.branch);
  if (parsed.child) params.set("child", parsed.child);
  const result = await api<SearchPage>(`search?${params}`);
  if (!result.ok) return result;
  const page = searchResponseSchema.safeParse(result.data);
  return page.success
    ? { ok: true, data: page.data }
    : {
        ok: false,
        code: "unavailable",
        message: "Search results could not be loaded. Please try again.",
      };
}

export const searchRecordRequestSchema = z.object({
  kind: z.enum(searchKinds),
  id: z.string().uuid(),
  offset: z.number().int().min(0).max(100000).default(0),
});
export interface SearchHydration {
  data: Record<string, Record<string, unknown>[]>;
  pagination: Record<
    string,
    { offset: number; total: number; next_offset: number | null }
  >;
}
export function hydrateSearchRecord(
  input: z.input<typeof searchRecordRequestSchema>,
): Promise<ServiceResult<SearchHydration>> {
  const value = searchRecordRequestSchema.parse(input);
  return api<SearchHydration>(
    `search/record?${new URLSearchParams({ kind: value.kind, id: value.id, offset: String(value.offset) })}`,
  );
}
