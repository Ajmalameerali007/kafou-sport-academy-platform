export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { ok: true, service: "kafou-sport-academy", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
