import {
  searchRequestSchema,
  searchResponseSchema,
  searchRecordRequestSchema,
  type SearchHydration,
} from "./search";
import { AppError, databaseError, type sessionClient } from "./server";

export async function readWorkspaceSearch(
  db: Awaited<ReturnType<typeof sessionClient>>,
  params: URLSearchParams,
) {
  const input = searchRequestSchema.parse({
    query: params.get("q"),
    kinds: params.get("kinds")?.split(","),
    after: params.get("after") || undefined,
    limit: params.has("limit") ? Number(params.get("limit")) : undefined,
    branch: params.get("branch") || undefined,
    child: params.get("child") || undefined,
  });
  const result = await db.rpc("workspace_search", {
    p_query: input.query,
    p_kinds: input.kinds,
    p_after: input.after,
    p_limit: input.limit,
    p_branch: input.branch,
    p_child: input.child,
  });
  if (result.error) throw databaseError(result.error);
  return searchResponseSchema.parse(result.data);
}

// Hydrates one selected destination using the caller's cookie/RLS client only.
// Each related collection is independently bounded, counted and paged. An ID or
// cursor is not a capability; missing/revoked primary records are always 404.
export async function readSearchRecord(
  db: Awaited<ReturnType<typeof sessionClient>>,
  params: URLSearchParams,
): Promise<SearchHydration> {
  const { kind, id, offset } = searchRecordRequestSchema.parse({
    kind: params.get("kind"),
    id: params.get("id"),
    offset: params.has("offset") ? Number(params.get("offset")) : undefined,
  });
  const data: SearchHydration["data"] = {};
  const pagination: SearchHydration["pagination"] = {};
  const page = async (
    table: string,
    query: PromiseLike<{
      data: unknown[] | null;
      error: { code?: string; message?: string } | null;
      count: number | null;
    }>,
    strip?: string,
  ) => {
    const result = await query;
    if (result.error) throw databaseError(result.error);
    data[table] = (result.data || []).map((row) => {
      const item = { ...(row as Record<string, unknown>) };
      if (strip) delete item[strip];
      return item;
    });
    const total = result.count ?? data[table].length;
    pagination[table] = {
      offset,
      total,
      next_offset: offset + 100 < total ? offset + 100 : null,
    };
  };
  const table =
    kind === "family" || kind === "child"
      ? "families"
      : kind === "lead"
        ? "leads"
        : kind === "class"
          ? "academy_classes"
          : "trial_enquiries";
  if (kind === "session") {
    // Staff session links use the RLS-protected canonical occurrence. The coach
    // projection below is deliberately not a staff authorization shortcut.
    const occurrence = await db
      .from("class_sessions")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (occurrence.error) throw databaseError(occurrence.error);
    if (occurrence.data) {
      data.class_sessions = [occurrence.data];
      const cls = await db
        .from("academy_classes")
        .select("*")
        .eq("id", occurrence.data.class_id)
        .maybeSingle();
      if (cls.error) throw databaseError(cls.error);
      if (cls.data) data.academy_classes = [cls.data];
      await page(
        "session_roster",
        db
          .from("session_roster")
          .select("*", { count: "exact" })
          .eq("session_id", id)
          .order("id")
          .range(offset, offset + 99),
      );
      return { data, pagination };
    }
    const row = await db.rpc("workspace_search_session", { p_id: id });
    if (row.error) throw databaseError(row.error);
    if (!row.data)
      throw new AppError("not_found", "Record is unavailable.", 404);
    data.coach_sessions = [row.data as Record<string, unknown>];
    data.development_sessions = data.coach_sessions;
    return { data, pagination };
  }
  const primary = await db.from(table).select("*").eq("id", id).maybeSingle();
  if (primary.error) throw databaseError(primary.error);
  if (!primary.data)
    throw new AppError("not_found", "Record is unavailable.", 404);
  data[table] = [primary.data];
  const range = [offset, offset + 99] as const;
  if (kind === "family" || kind === "child") {
    await Promise.all([
      page(
        "children",
        db
          .from("children")
          .select("*", { count: "exact" })
          .eq("family_id", id)
          .order("id")
          .range(...range),
      ),
      page(
        "child_sports",
        db
          .from("child_sports")
          .select("*,children!inner(family_id)", { count: "exact" })
          .eq("children.family_id", id)
          .order("id")
          .range(...range),
        "children",
      ),
      page(
        "enrollments",
        db
          .from("enrollments")
          .select("*,children!inner(family_id)", { count: "exact" })
          .eq("children.family_id", id)
          .order("id")
          .range(...range),
        "children",
      ),
    ]);
  } else if (kind === "lead") {
    await Promise.all([
      page(
        "lead_activities",
        db
          .from("lead_activities")
          .select("*", { count: "exact" })
          .eq("lead_id", id)
          .order("id")
          .range(...range),
      ),
      page(
        "trial_enquiries",
        db
          .from("trial_enquiries")
          .select("*", { count: "exact" })
          .eq("lead_id", id)
          .order("id")
          .range(...range),
      ),
      page(
        "trial_bookings",
        db
          .from("trial_bookings")
          .select("*,trial_enquiries!inner(lead_id)", { count: "exact" })
          .eq("trial_enquiries.lead_id", id)
          .order("id")
          .range(...range),
        "trial_enquiries",
      ),
    ]);
  } else if (kind === "class") {
    await Promise.all([
      page(
        "class_sessions",
        db
          .from("class_sessions")
          .select("*", { count: "exact" })
          .eq("class_id", id)
          .order("id")
          .range(...range),
      ),
      page(
        "session_roster",
        db
          .from("session_roster")
          .select("*,class_sessions!inner(class_id)", { count: "exact" })
          .eq("class_sessions.class_id", id)
          .order("id")
          .range(...range),
        "class_sessions",
      ),
    ]);
  } else {
    await Promise.all([
      page(
        "trial_bookings",
        db
          .from("trial_bookings")
          .select("*", { count: "exact" })
          .eq("enquiry_id", id)
          .order("id")
          .range(...range),
      ),
      page(
        "class_sessions",
        db
          .from("class_sessions")
          .select("*,trial_bookings!inner(enquiry_id)", { count: "exact" })
          .eq("trial_bookings.enquiry_id", id)
          .order("id")
          .range(...range),
        "trial_bookings",
      ),
    ]);
  }
  return { data, pagination };
}
