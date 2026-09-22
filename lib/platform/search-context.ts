import { searchRecordRequestSchema } from "./search";

type Data = Record<string, Record<string, unknown>[]>;
export function recordContext(params: URLSearchParams) {
  const parsed = searchRecordRequestSchema.safeParse({
    kind: params.get("recordKind"),
    id: params.get("record"),
  });
  return parsed.success ? parsed.data : null;
}

/** Reconcile record identity, rather than keeping two versions of a changed row. */
export function mergeWorkspaceRecords(current: Data, incoming: Data): Data {
  const next = { ...current };
  for (const [table, rows] of Object.entries(incoming)) {
    if (!Array.isArray(rows)) continue;
    if (table.endsWith("pagination")) {
      next[table] = rows;
      continue;
    }
    const key = (row: Record<string, unknown>) =>
      typeof row.id === "string"
        ? row.id
        : JSON.stringify(
            Object.keys(row)
              .sort()
              .map((k) => [k, row[k]]),
          );
    next[table] = [
      ...new Map(
        [...(current[table] || []), ...rows].map((row) => [key(row), row]),
      ).values(),
    ];
  }
  return next;
}

/** A temporary transport failure must remain refreshable at the same target. */
export function recordAccessLost(code: string) {
  return ["unauthenticated", "forbidden", "not_found"].includes(code);
}
export function clearRecordUrl(href: string) {
  const url = new URL(href);
  url.searchParams.delete("record");
  url.searchParams.delete("recordKind");
  return url;
}
