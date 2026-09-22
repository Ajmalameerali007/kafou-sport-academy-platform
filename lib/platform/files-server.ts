import { createHash } from "node:crypto";
import { fileUploadSchema, validateFileBytes } from "./files";
import {
  AppError,
  databaseError,
  privilegedClient,
  type sessionClient,
} from "./server";
import type { Json } from "./database.types";
type DB = Awaited<ReturnType<typeof sessionClient>>;
export async function uploadFamilyFile(db: DB, body: unknown) {
  const v = fileUploadSchema.parse(body);
  const bytes = Uint8Array.from(atob(v.content), (c) => c.charCodeAt(0));
  if (!validateFileBytes(bytes, v.mime_type))
    throw new AppError(
      "validation",
      "Use a PDF, PNG or JPEG file up to 512 KB.",
      400,
    );
  const start = await db.rpc("product_command", {
    p_action: "files.begin",
    p_data: {
      family_id: v.family_id,
      ...(v.child_id ? { child_id: v.child_id } : {}),
      ...(v.branch_id ? { branch_id: v.branch_id } : {}),
      name: v.name,
      mime_type: v.mime_type,
      size_bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    } as Json,
    p_key: v.key,
  });
  if (start.error) throw databaseError(start.error);
  const record = start.data as { id: string; path: string };
  const meta = await db
    .from("family_files")
    .select("*")
    .eq("id", record.id)
    .single();
  if (meta.error || !meta.data)
    throw new AppError("forbidden", "File access changed. Try again.", 403);
  if (meta.data.status === "ready") return { id: record.id };
  if (meta.data.status !== "pending")
    throw new AppError("conflict", "This upload is no longer available.", 409);
  // Exact authorized object path only. No arbitrary path or signed public URL accepted from clients.
  const bucket = privilegedClient().storage.from("kafou-private-documents");
  const upload = await bucket.upload(meta.data.object_path, bytes, {
    contentType: v.mime_type,
    upsert: false,
  });
  if (
    upload.error &&
    String(upload.error.statusCode) !== "409" &&
    upload.error.message !== "The resource already exists"
  )
    throw new AppError(
      "unavailable",
      "The document could not be stored. Please retry.",
      503,
    );
  const done = await db.rpc("product_command", {
    p_action: "files.finish",
    p_data: { id: record.id },
    p_key: crypto.randomUUID(),
  });
  if (done.error) throw databaseError(done.error);
  return { id: record.id };
}
export async function downloadFamilyFile(db: DB, id: string) {
  const r = await db
    .from("family_files")
    .select("*")
    .eq("id", id)
    .eq("status", "ready")
    .maybeSingle();
  if (r.error) throw databaseError(r.error);
  if (!r.data)
    throw new AppError("not_found", "Document is not available.", 404);
  const authorized = await db.rpc("product_command", {
    p_action: "files.download",
    p_data: { id },
    p_key: crypto.randomUUID(),
  });
  if (authorized.error) throw databaseError(authorized.error);
  const download = await privilegedClient()
    .storage.from("kafou-private-documents")
    .download(r.data.object_path);
  if (download.error)
    throw new AppError(
      "unavailable",
      "Document retrieval is unavailable. Please try again.",
      503,
    );
  return new Response(await download.data.arrayBuffer(), {
    headers: {
      "Content-Type": r.data.mime_type,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(r.data.name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'",
    },
  });
}
