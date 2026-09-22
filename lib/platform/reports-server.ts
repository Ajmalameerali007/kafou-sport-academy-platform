import { z } from "zod";
import { databaseError, type sessionClient } from "./server";
import type { businessReports } from "./reports";
export type CompleteReport = Omit<
  ReturnType<typeof businessReports>,
  "finance"
> & {
  asOf: string;
  financeVisible: boolean;
  financeScope: "selected_branch_all_sports";
  finance:
    | (ReturnType<typeof businessReports>["finance"] & {
        refundedMinor: number;
      })
    | null;
};
export async function readBusinessReport(
  db: Awaited<ReturnType<typeof sessionClient>>,
  params: URLSearchParams,
) {
  const date = z.string().date();
  const from = date.parse(params.get("from"));
  const to = date.parse(params.get("to"));
  const branch = z.string().uuid().nullable().parse(params.get("branch"));
  const sport = z
    .enum(["swimming", "football", "karate", "badminton"])
    .nullable()
    .parse(params.get("sport"));
  const { data, error } = await db.rpc("business_report", {
    p_from: from,
    p_to: to,
    p_branch: branch || undefined,
    p_sport: sport || undefined,
  });
  if (error) throw databaseError(error);
  return data as unknown as CompleteReport;
}
