import { cookies } from "next/headers";
import { config } from "./server";
const encoder = new TextEncoder();
async function key() {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret) throw new Error("Signing configuration unavailable");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`enquiry:${secret}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function rememberGuestEnquiry(id: string) {
  const payload = `${id}.${Math.floor(Date.now() / 1000) + 3600}`;
  const sig = Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", await key(), encoder.encode(payload)),
    ),
    (n) => n.toString(16).padStart(2, "0"),
  ).join("");
  (await cookies()).set("kafou-enquiry", `${payload}.${sig}`, {
    httpOnly: true,
    secure: config().origin.startsWith("https:"),
    sameSite: "strict",
    path: "/api",
    maxAge: 3600,
  });
}
export async function ownsGuestEnquiry(id: string) {
  const value = (await cookies()).get("kafou-enquiry")?.value || "";
  const [record, expires, signature] = value.split(".");
  if (
    record !== id ||
    Number(expires) < Date.now() / 1000 ||
    !/^[a-f0-9]{64}$/.test(signature || "")
  )
    return false;
  const bytes = Uint8Array.from(signature.match(/../g)!, (n) =>
    parseInt(n, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    await key(),
    bytes,
    encoder.encode(`${record}.${expires}`),
  );
}
