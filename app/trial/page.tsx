import type { Metadata } from "next";
import { getLocale } from "@/lib/kafou/server-locale";
import { TrialPage } from "@/components/kafou/trial-page";
export const metadata: Metadata = {
  title: "Start a free trial | KAFOU Sport Academy",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const single = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  return (
    <>
      <TrialPage
        locale={await getLocale()}
        initialSport={single(query.sport)}
        initialBranch={single(query.branch)}
      />
    </>
  );
}
