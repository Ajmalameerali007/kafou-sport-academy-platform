import { z } from "zod";
import { attendanceRpc } from "./attendance-server";
import { signedPhoto } from "./attendance-photos-server";
import type { sessionClient } from "./server";

type DB = Awaited<ReturnType<typeof sessionClient>>;

const classId = z.string().uuid();

/**
 * Returns the synthetic classes that may be used to create an immediate,
 * auditable check-in rehearsal. The database function applies the branch and
 * role scope; the UI never receives classes outside that scope.
 */
export function checkinRehearsalOptions(db: DB) {
  return attendanceRpc(db, "checkin_rehearsal_options", {});
}

/**
 * Creates (or reuses) a live session/roster in the local synthetic database.
 * The write is signed by the server and is deliberately unavailable outside
 * the configured loopback rehearsal runtime.
 */
export function createCheckinRehearsal(db: DB, actor: string, input: unknown) {
  const value = z.object({ class_id: classId }).strict().parse(input);
  return signedPhoto(
    db,
    "checkin_rehearsal",
    { kind: "checkin_rehearsal", class_id: value.class_id },
    actor,
  );
}
