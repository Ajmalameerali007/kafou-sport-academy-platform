import { jobStatusSchema } from "./jobs";
import { databaseError, type sessionClient } from "./server";
/** Cookie-scoped observation only. The worker is never exposed through the HTTP API. */
export async function readJobStatus(
  db: Awaited<ReturnType<typeof sessionClient>>,
) {
  const { data, error } = await db.rpc("scheduler_status");
  if (error) throw databaseError(error);
  return jobStatusSchema.parse(data);
}
