import { AuthCompletion } from "@/components/platform/auth-completion";
import { getLocale } from "@/lib/kafou/server-locale";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <AuthCompletion locale={await getLocale()} reset />;
}
