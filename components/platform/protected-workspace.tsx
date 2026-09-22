import { redirect } from "next/navigation";
import { dailyRead } from "@/lib/platform/daily-server";
import { context, AppError } from "@/lib/platform/server";
import { canEnter } from "@/lib/platform/contracts";
import { getLocale } from "@/lib/kafou/server-locale";
import { Workspace } from "./workspace";
export async function ProtectedWorkspace({ workspace }: { workspace: string }) {
  let account;
  try {
    account = (await context()).account;
  } catch (e) {
    if (e instanceof AppError && e.code === "unauthenticated")
      redirect("/auth");
    return (
      <main className="access-message">
        <h1>KAFOU</h1>
        <p>Account access unavailable · تعذّر الوصول إلى الحساب</p>
        <a href="/auth">Sign in · تسجيل الدخول</a>
      </main>
    );
  }
  if (workspace === "accounts") {
    if (!account.roles.some(r=>r!=='parent')) redirect('/account');
    const { db } = await context();
    const access = (await dailyRead(
      db,
      new URLSearchParams("view=shifts"),
    )) as {
      can_expenses: boolean;
      can_payroll: boolean;
      can_timekeeping: boolean;
    };
    if (!access.can_expenses && !access.can_payroll && !access.can_timekeeping)
      redirect("/account");
  } else if (!canEnter(account, workspace)) redirect("/account");
  return (
    <Workspace
      locale={await getLocale()}
      account={account}
      workspace={workspace}
    />
  );
}
