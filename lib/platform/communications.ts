import { z } from "zod";
const id = z.string().uuid();
export const communicationsSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("communication.template.create"),
    data: z.object({
      branch_id: id,
      name: z.string().min(2).max(100),
      language: z.enum(["en", "ar"]),
      purpose: z.enum(["operational", "marketing"]),
      subject: z.string().min(2).max(160),
      body: z.string().min(5).max(800),
    }),
  }),
  z.object({
    action: z.literal("communication.preview"),
    data: z.object({ branch_id: id, template_id: id }),
  }),
  z.object({
    action: z.literal("communication.schedule"),
    data: z.object({
      branch_id: id,
      template_id: id,
      scheduled_at: z.string().datetime({ offset: true }),
      confirmed: z.literal(true),
    }),
  }),
  z.object({
    action: z.literal("communication.dispatch"),
    data: z.object({ id }),
  }),
  z.object({
    action: z.literal("communication.cancel"),
    data: z.object({ id }),
  }),
]);
export const communicationTables = [
  "communication_templates",
  "communication_batches",
  "communication_recipients",
] as const;
