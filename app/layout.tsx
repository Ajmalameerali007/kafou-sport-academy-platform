import "./daily-operations.css";
import "./attendance.css";
import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
import "./product.css";
import "./family-workspace.css";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "KAFOU Sport Academy | Stronger kids. Brighter futures.",
  description:
    "Swimming, football, karate and badminton. Discover a stronger, more confident future with KAFOU Sport Academy.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale =
    (await cookies()).get("kafou-locale")?.value === "ar" ? "ar" : "en";
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
