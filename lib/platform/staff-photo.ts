import { z } from "zod";
const id = z.string().uuid();
const photo = z.string().min(1).max(11_200_000);
export const staffPhotoSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent"), staff: id, granted: z.boolean() }).strict(),
  z.object({ action: z.literal("reference"), staff: id, content: photo }).strict(),
  z.object({ action: z.literal("preview"), staff: id, reference: id }).strict(),
  z.object({ action: z.literal("approve"), staff: id, reference: id }).strict(),
  z.object({ action: z.literal("process"), staff: id, reference: id, key: id, content: photo,
    clock: z.discriminatedUnion("action", [
      z.object({ action: z.literal("shift.in"), data: z.object({ branch_id: id.nullable() }).strict() }).strict(),
      z.object({ action: z.literal("shift.out"), data: z.object({ id }).strict() }).strict(),
    ]),
  }).strict(),
]);
export function verifiedStaffFace(faces: {status?: unknown; reference?: unknown}[], reference: string) {
  return faces.length === 1 && faces[0].status === "matched" && faces[0].reference === reference;
}
