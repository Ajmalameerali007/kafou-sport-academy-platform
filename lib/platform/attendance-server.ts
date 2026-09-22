import { z } from "zod";
import { AppError, databaseError, type sessionClient } from "./server";
import type { Json } from "./database.types";
const command = z
  .object({
    session: z.string().uuid(),
    action: z.enum(["save", "finish", "review"]),
    revision: z.number().int().nonnegative(),
    roster_token: z.string().length(32),
    marks: z.record(
      z.string().uuid(),
      z.enum(["", "present", "late", "absent", "excused"]),
    ),
    key: z.string().uuid(),
    roster: z.string().uuid().optional(),
  })
  .strict();
export async function attendanceRpc(
  db: Awaited<ReturnType<typeof sessionClient>>,
  name: string,
  args: Record<string, Json>,
) {
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
  if (r.error) {
    const messages = new Set([
      "The register changed. Review the latest draft before saving.",
      "The draft changed while processing. Review and retry.",
      "Consent, reference or roster changed. Process the photo again.",
      "Photo consent or reference changed. Review automatic marks manually before finishing.",
      "Attendance is locked. Use an authorized correction with a reason.",
      "Resolve every unmarked student before finishing attendance.",
      "Consent changed. Review consent before enrolling a reference.",
      "Reference or consent changed",
      "Use a new photo for each clock action.",
      "Photo request changed",
      "No remaining session entitlement",
      "No membership covers this session date",
      "Membership is not eligible for session use",
      "This session has reached its limit of 10 photographs. Resolve remaining students manually.",
    ]);
    if (r.error.message && messages.has(r.error.message))
      throw new AppError(
        r.error.code === "P0409" ? "conflict" : "validation",
        r.error.message,
        r.error.code === "P0409" ? 409 : 400,
      );
    throw databaseError(r.error);
  }
  return r.data;
}
export async function readAttendance(
  db: Awaited<ReturnType<typeof sessionClient>>,
  session: unknown,
) {
  return attendanceRpc(db, "attendance_register", {
    p_session: z.string().uuid().parse(session),
  });
}
export async function writeAttendance(
  db: Awaited<ReturnType<typeof sessionClient>>,
  input: unknown,
) {
  const v = command.parse(input);
  if (v.action === "review")
    return attendanceRpc(db, "attendance_manual_review", {
      p_session: v.session,
      p_revision: v.revision,
      p_token: v.roster_token,
      p_roster: z.string().uuid().parse(v.roster),
      p_key: v.key,
    });
  return attendanceRpc(db, "attendance_draft_command", {
    p_session: v.session,
    p_action: v.action,
    p_revision: v.revision,
    p_roster_token: v.roster_token,
    p_marks: v.marks,
    p_key: v.key,
  });
}
