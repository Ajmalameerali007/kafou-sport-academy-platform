import type { Metadata } from "next";
import { getLocale } from "@/lib/kafou/server-locale";
import { AuthPage } from "@/components/kafou/auth-page";
export const metadata: Metadata = {
  title: "Log in or create an account | KAFOU Sport Academy",
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
      <AuthPage
        locale={await getLocale()}
        initialView={single(query.view)}
        initialStaff={single(query.staff)}
      />
    </>
  );
}
