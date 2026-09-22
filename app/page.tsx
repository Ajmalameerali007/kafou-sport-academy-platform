import { PublicHome } from "@/components/kafou/home";
import { getLocale } from "@/lib/kafou/server-locale";
export default async function Home() {
  return <PublicHome locale={await getLocale()} />;
}
