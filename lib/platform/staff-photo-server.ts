import { AppError, type sessionClient } from "./server";
import { attendanceRpc } from "./attendance-server";
import { photoEngine, photoSecret, signedPhoto } from "./attendance-photos-server";
import { staffPhotoSchema, verifiedStaffFace } from "./staff-photo";
import type { Json } from "./database.types";
type DB = Awaited<ReturnType<typeof sessionClient>>;
type Row = Record<string, Json>;

export async function staffPhotoCommand(db: DB, actor: string, aal: string, input: unknown) {
  photoSecret();
  const v = staffPhotoSchema.parse(input);
  const info = (await attendanceRpc(db, "staff_photo_info", { p_staff: v.staff })) as Row;
  if (info.synthetic !== true) throw new AppError("forbidden", "Use a synthetic staff account for this rehearsal.", 403);
  if (["consent", "reference", "process"].includes(v.action) && v.staff !== actor)
    throw new AppError("forbidden", "Staff must consent and verify their own account.", 403);
  const references = info.references as Row[];
  if (v.action === "consent") {
    const result = await attendanceRpc(db, "staff_photo_consent", { p_staff: v.staff, p_granted: v.granted }) as Row;
    try { await photoEngine({ action: "delete", references: result.delete_references }); }
    catch { /* The private retention sweep retries physical deletion. Consent is already revoked. */ }
    return result;
  }
  if (v.action === "preview") {
    if (!references.some(r => r.id === v.reference)) throw new AppError("forbidden", "Reference access changed.", 403);
    const preview = await photoEngine({ action: "preview", reference: v.reference });
    const fresh = await attendanceRpc(db, "staff_photo_info", { p_staff: v.staff }) as Row;
    if (!(fresh.references as Row[]).some(r => r.id === v.reference)) throw new AppError("forbidden", "Reference access changed.", 403);
    return preview;
  }
  if (v.action === "approve") return attendanceRpc(db, "staff_reference_approve", { p_staff: v.staff, p_reference: v.reference });
  if (!info.consent) throw new AppError("forbidden", "Record synthetic staff consent before adding a face reference.", 403);
  if (v.action === "reference") {
    const reference = crypto.randomUUID();
    const result = await photoEngine({ action: "staff_reference", reference, content: v.content });
    try {
      const saved = await signedPhoto(db, "staff_reference_candidate", {
        kind: "staff_reference", staff: v.staff, reference, version: info.version, ...result,
      }, actor);
      try { await photoEngine({ action: "delete", references: references.map(r => r.id) }); } catch { /* Retention retries. */ }
      return saved;
    } catch (error) {
      // A lost HTTP response may hide a committed enrollment. Never delete its file.
      try {
        const current = await attendanceRpc(db, "staff_photo_info", { p_staff: v.staff }) as Row;
        if ((current.references as Row[]).some(r => r.id === reference)) return current;
        await photoEngine({ action: "delete", references: [reference] });
      } catch { /* Retention removes confirmed orphans after authorization recovers. */ }
      throw error;
    }
  }
  if (!references.some(r => r.id === v.reference && r.approved)) throw new AppError("forbidden", "An approved staff photo is required.", 403);
  const result = await photoEngine({ action: "staff_match", actor, aal, reference: v.reference, content: v.content });
  return signedPhoto(db, "staff_photo_accept", {
    kind: "staff_session", staff: v.staff, reference: v.reference, key: v.key,
    action: v.clock.action, data: v.clock.data,
    matched: verifiedStaffFace((result.faces as Row[]) || [], v.reference),
    sha256: result.sha256, processing_ms: result.processing_ms,
  }, actor);
}
