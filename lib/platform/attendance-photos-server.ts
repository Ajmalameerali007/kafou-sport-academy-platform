import { createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError, type sessionClient } from "./server";
import { isLocalDemoRuntime } from "./local-demo";
import { attendanceRpc, readAttendance } from "./attendance-server";
import type { Json } from "./database.types";
type DB = Awaited<ReturnType<typeof sessionClient>>;
type Row = Record<string, Json>;
export function photoSecret() {
  if (
    !isLocalDemoRuntime(process.env.SUPABASE_URL, process.env.APP_URL) ||
    !process.env.ATTENDANCE_LOCAL_KEY
  )
    throw new AppError(
      "unavailable",
      "Photo matching is available only in the configured local synthetic rehearsal.",
      503,
    );
  return process.env.ATTENDANCE_LOCAL_KEY;
}
export async function photoEngine(data: unknown): Promise<Row> {
  const response = await fetch("http://127.0.0.1:8766", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${photoSecret()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  }).catch(() => {
    throw new AppError(
      "unavailable",
      "Local photo processor is unavailable. Manual attendance is still available.",
      503,
    );
  });
  const result = (await response.json()) as {
    ok: boolean;
    data: Row;
    message: string;
  };
  if (!result.ok) throw new AppError("validation", result.message, 400);
  return result.data;
}
export async function signedPhoto(db: DB, name: string, payload: Row, actor: string) {
  const body = JSON.stringify({ ...payload, actor, time: Date.now() / 1000 });
  return attendanceRpc(db, name, {
    p_payload: body,
    p_signature: createHmac("sha256", photoSecret()).update(body).digest("hex"),
  });
}
export async function photoInput(request: Request) {
  photoSecret();
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("validation", "Photo required", 400);
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const r = await reader.read();
    if (r.done) break;
    length += r.value.length;
    if (length > 12_000_000) {
      await reader.cancel();
      throw new AppError("validation", "Use a photo smaller than 8 MB.", 413);
    }
    chunks.push(r.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AppError("validation", "Invalid photo request", 400);
  }
}
const id = z.string().uuid();
export async function photoCommand(
  db: DB,
  actor: string,
  input: unknown,
  aal: string,
) {
  photoSecret();
  const v = z
    .object({
      action: z.enum([
        "consent",
        "reference",
        "approve",
        "preview",
        "process",
        "thumbnail",
      ]),
      child: id.optional(),
      reference: id.optional(),
      session: id.optional(),
      roster: id.optional(),
      granted: z.boolean().optional(),
      content: z.string().max(11_200_000).optional(),
      revision: z.number().int().nonnegative().optional(),
      roster_token: z.string().length(32).optional(),
    })
    .strict()
    .parse(input);
  if (v.action === "consent") {
    const result = (await attendanceRpc(db, "attendance_photo_consent", {
      p_child: id.parse(v.child),
      p_granted: z.boolean().parse(v.granted),
    })) as Row;
    await photoEngine({ action: "delete", references: result.delete_references });
    return result;
  }
  if (v.action === "thumbnail") {
    const session = id.parse(v.session),
      roster = id.parse(v.roster);
    const scope = (await attendanceRpc(db, "attendance_photo_scope", {
      p_session: session,
    })) as Row[];
    const target = scope.find(
      (r) => r.roster === roster && r.status === "ready",
    );
    if (!target)
      throw new AppError(
        "not_found",
        "Approved reference is unavailable.",
        404,
      );
    const preview = await photoEngine({
      action: "preview",
      reference: target.reference,
      thumbnail: true,
    });
    const current = (await attendanceRpc(db, "attendance_photo_scope", {
      p_session: session,
    })) as Row[];
    if (
      !current.some(
        (r) =>
          r.roster === roster &&
          r.reference === target.reference &&
          r.status === "ready",
      )
    )
      throw new AppError("forbidden", "Reference access changed.", 403);
    return preview;
  }
  if (v.action === "process") {
    const session = id.parse(v.session);
    const register = (await readAttendance(db, session)) as Row;
    if (register.finalized_at || !register.can_photo)
      throw new AppError(
        "forbidden",
        "Photo processing is unavailable for this session or permission.",
        403,
      );
    if (
      register.revision !== v.revision ||
      register.roster_token !== v.roster_token
    )
      throw new AppError(
        "conflict",
        "The draft changed. Review the latest register before processing.",
        409,
      );
    const scope = (await attendanceRpc(db, "attendance_photo_scope", {
      p_session: session,
    })) as Row[];
    const refs = scope
      .filter((r) => r.status === "ready")
      .map((r) => r.reference);
    if (!refs.length)
      throw new AppError(
        "conflict",
        "No approved, consented references on this roster. Manual attendance is available.",
        409,
      );
    const result = await photoEngine({
      action: "match",
      session,
      actor,
      aal,
      content: z.string().min(1).parse(v.content),
      references: refs,
    });
    const faces = result.faces as Row[];
    if (!faces.length) faces.push({ status: "photo_unclear" });
    const matched = [
      ...new Set(
        faces
          .filter((f) => f.status === "matched")
          .flatMap((f) =>
            scope
              .filter((r) => r.reference === f.reference)
              .map((r) => r.roster),
          ),
      ),
    ];
    const accepted = (await signedPhoto(
      db,
      "attendance_photo_accept",
      {
        kind: "session",
        session,
        scope,
        revision: register.revision,
        roster_token: register.roster_token,
        sha256: result.sha256,
        matched,
        exceptions: faces
          .filter((f) => f.status !== "matched")
          .map((f) => f.status),
        processing_ms: result.processing_ms,
      },
      actor,
    )) as Row;
    const refreshed = (await readAttendance(db, session)) as Row;
    return {
      ...accepted,
      recognized: matched.length,
      revision: refreshed.revision,
    };
  }
  const child = id.parse(v.child);
  const info = (await attendanceRpc(db, "attendance_reference_info", {
    p_child: child,
  })) as Row;
  const references = info.references as Row[];
  if (v.action === "reference") {
    if (!info.guardian || !info.consent || !info.synthetic)
      throw new AppError(
        "forbidden",
        "Record separate guardian consent for this synthetic child before enrolling a reference.",
        403,
      );
    const reference = randomUUID();
    const result = await photoEngine({
      action: "reference",
      reference,
      content: z.string().min(1).parse(v.content),
    });
    let saved: unknown;
    try {
      saved = await signedPhoto(
        db,
        "attendance_reference_candidate",
        {
          kind: "reference",
          child,
          reference,
          version: info.version,
          ...result,
        },
        actor,
      );
    } catch (e) {
      // A lost RPC response can hide a committed enrollment. Never delete blindly.
      try {
        const current = (await attendanceRpc(db, "attendance_reference_info", {
          p_child: child,
        })) as Row;
        if ((current.references as Row[]).some((r) => r.id === reference))
          return current;
        await photoEngine({ action: "delete", references: [reference] });
      } catch {
        /* The retention worker removes confirmed orphans after authorization recovers. */
      }
      throw e;
    }
    // Database enrollment committed: cleanup failure must never delete its new file.
    try {
      await photoEngine({
        action: "delete",
        references: references.map((r) => r.id),
      });
    } catch {
      /* Private worker retention sweep retries obsolete-file removal. */
    }
    return saved;
  }
  const reference = id.parse(v.reference);
  if (!references.some((r) => r.id === reference))
    throw new AppError("forbidden", "Reference access changed.", 403);
  const preview = await photoEngine({ action: "preview", reference });
  if (v.action === "preview") {
    const fresh = (await attendanceRpc(db, "attendance_reference_info", {
      p_child: child,
    })) as Row;
    if (!(fresh.references as Row[]).some((r) => r.id === reference))
      throw new AppError("forbidden", "Reference access changed.", 403);
    return preview;
  }
  return attendanceRpc(db, "attendance_reference_approve", {
    p_child: child,
    p_reference: reference,
  });
}
