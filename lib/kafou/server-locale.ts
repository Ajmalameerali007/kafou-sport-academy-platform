import { cookies } from "next/headers";
export async function getLocale(): Promise<"en" | "ar"> {
  return (await cookies()).get("kafou-locale")?.value === "ar" ? "ar" : "en";
}
