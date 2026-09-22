import { NotFoundPage } from "@/components/kafou/not-found-page";
import { getLocale } from "@/lib/kafou/server-locale";
export default async function NotFound() {
  return <NotFoundPage locale={await getLocale()} />;
}
