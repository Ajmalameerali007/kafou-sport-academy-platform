import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        for (const i of items) request.cookies.set(i.name, i.value);
        response = NextResponse.next({ request });
        for (const i of items)
          response.cookies.set(i.name, i.value, {
            ...i.options,
            httpOnly: true,
            sameSite: "lax",
            secure: request.nextUrl.protocol === "https:",
            ...(request.cookies.get("kafou-remember")?.value !== "yes" &&
            i.options.maxAge !== 0
              ? { maxAge: undefined, expires: undefined }
              : {}),
          });
      },
    },
  });
  await db.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/account/:path*",
    "/admin/:path*",
    "/parent/:path*",
    "/branch/:path*",
    "/sales/:path*",
    "/coach/:path*",
    "/auth/:path*",
    "/api/:path*",
  ],
};
