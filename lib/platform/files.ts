import { z } from "zod";
export const fileUploadSchema = z.object({
  family_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  name: z
    .string()
    .min(1)
    .max(160)
    .regex(/^[^/\\\x00-\x1f]+$/),
  mime_type: z.enum(["application/pdf", "image/png", "image/jpeg"]),
  content: z
    .string()
    .max(700000)
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/)
    .min(4),
  key: z.string().uuid(),
});
export function validateFileBytes(bytes: Uint8Array, mime: string) {
  if (bytes.length < 4 || bytes.length > 524288) return false;
  if (mime === "application/pdf")
    return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  if (mime === "image/png")
    return bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10";
  return (
    mime === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  );
}
export const filesSchema = z.object({
  action: z.literal("files.withdraw"),
  data: z.object({ id: z.string().uuid() }),
});
export const fileTables = ["family_files", "file_access_events"] as const;
