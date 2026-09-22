import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, config, context, databaseError, failure, input, ok, checkOrigin, limit } from "@/lib/platform/server";
import type { Database, Json } from "@/lib/platform/database.types";
import { commandSchema, mayCommand } from "@/lib/platform/contracts";
import { operationSchema, mayOperate } from "@/lib/platform/operations";
import { productSchema, productAccess, downloadCertificate, downloadReceipt, downloadReport } from "@/lib/platform/product-server";
import { downloadFamilyFile, uploadFamilyFile } from "@/lib/platform/files-server";
import { memberQuery, memberCommand, type MemberPage } from "./contracts";

export async function handleMemberRequest(request: Request) {
  try {
    const authorization = request.headers.get("authorization") || "";
    if (!/^Bearer [A-Za-z0-9._-]+$/.test(authorization) || authorization.length > 12000)
      throw new AppError("unauthenticated", "Please sign in to continue.", 401);
    const { url, key } = config();
    const db = createClient<Database>(url, key, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    // Auth server verification (not locally decoded claims), followed by existing active-account checks.
    const verified = await db.auth.getUser(authorization.slice(7));
    if (verified.error || !verified.data.user) throw new AppError("unauthenticated", "Please sign in again.", 401);
    const { account } = await context(db);
    if (!account.active || account.roles.length !== 1 || account.roles[0] !== "parent")
      throw new AppError("forbidden", "A parent account is required.", 403);
    const endpoint = new URL(request.url).pathname.replace(/^\/api\/member\/v1\//, "");
    const params = new URL(request.url).searchParams;
    // Schema generated before this additive migration; only these two exact RPC names are bridged.
    const rpc = db as unknown as { rpc(name: "member_v1_read" | "member_v1_command", args: Record<string, Json>): PromiseLike<{data: unknown; error: {code?: string; message?: string} | null}> };
    if (request.method === "GET") {
      if (endpoint === "context") return ok({ user_id: account.userId, name: account.name, email: verified.data.user.email, roles: account.roles, timezone: "Asia/Dubai", providers: { payments: false, whatsapp: false, push: false }, actions: ["family.create", "family.update", "child.save", "child.sport", "consent.record", "community.contact.save", "community.ticket.open"] });
      if (endpoint.startsWith("documents/")) {
        const [, kind, rawID] = endpoint.split("/");
        const id = z.string().uuid().parse(rawID);
        const locale = params.get("locale") === "ar" ? "ar" : "en";
        if (kind === "certificate") return await downloadCertificate(db, id);
        if (kind === "report") return await downloadReport(db, id, locale);
        if (kind === "receipt") return await downloadReceipt(db, id, locale);
        if (kind === "file") return await downloadFamilyFile(db, id);
        throw new AppError("not_found", "Document unavailable.", 404);
      }
      if (endpoint === "makeup-options" || endpoint === "trial-options") {
        const id = z.string().uuid().parse(params.get("id"));
        const result = endpoint === "makeup-options" ? await db.rpc("makeup_availability", { p_credit: id }) : await db.rpc("trial_availability", { p_enquiry: id });
        if (result.error) throw databaseError(result.error);
        return ok(result.data);
      }
      if (endpoint === "conversation-messages") {
        const id=z.string().uuid().parse(params.get("id"));
        const offset=z.coerce.number().int().min(0).max(100000).parse(params.get("cursor")||0);
        // The checked-in generated types predate the additive coach-message
        // migration. Keep the bridge local to this one known table until the
        // next hosted schema type generation, rather than weakening the main
        // client type across every member endpoint.
        const messageDb = db as unknown as {
          from(name: "coach_messages"): {
            select(columns: string): {
              eq(column: string, value: string): {
                eq(column: string, value: string): {
                  order(column: string): {
                    order(column: string): {
                      range(from: number, to: number): PromiseLike<{
                        data: Array<Record<string, unknown>> | null;
                        error: { code?: string; message?: string } | null;
                      }>;
                    };
                  };
                };
              };
            };
          };
        };
        const r=await messageDb.from("coach_messages").select("id,conversation_id,author_id,body,status,created_at").eq("conversation_id",id).eq("status","published").order("created_at").order("id").range(offset,offset+50);
        if(r.error) throw databaseError(r.error);
        return ok({items:(r.data||[]).slice(0,50),next_cursor:(r.data?.length||0)>50?offset+50:null});
      }
      if (endpoint === "conversations") {
        const r = await db.rpc("coach_conversation_options");
        if (r.error) throw databaseError(r.error);
        return ok(r.data);
      }
      const query = memberQuery.parse({ resource: endpoint, child: params.get("child"), cursor: params.get("cursor") || 0, limit: params.get("limit") || 50 });
      const result = await rpc.rpc("member_v1_read", { p_resource: query.resource, p_child: query.child, p_offset: query.cursor, p_limit: query.limit });
      if (result.error) throw databaseError(result.error);
      return ok(result.data as MemberPage);
    }
    if (request.method !== "POST") throw new AppError("method_not_allowed", "Method not allowed.", 405);
    // Native callers authenticate exclusively by bearer token. Browser origins retain the existing gate.
    if (request.headers.has("origin")) checkOrigin(request);
    if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError("validation", "JSON is required.", 415);
    await limit(request, `member:${account.userId}`, 150);
    if (endpoint === "files/upload") {
      if (Number(request.headers.get("content-length")||0)>720000) throw new AppError("validation","File too large.",413);
      const raw=await request.text();if(raw.length>720000)throw new AppError("validation","File too large.",413);
      let value:unknown;try{value=JSON.parse(raw);}catch{throw new AppError("validation","Invalid upload.",400);}
      return ok(await uploadFamilyFile(db,value));
    }
    if (endpoint === "conversation-command") {
      const value = z.object({ key: z.string().uuid(), action: z.enum(["open", "reply", "read"]), data: z.record(z.unknown()) }).strict().parse(await input(request));
      const data = value.action === "open" ? z.object({enrollment_id:z.string().uuid()}).strict().parse(value.data) : value.action === "reply" ? z.object({conversation_id:z.string().uuid(), body:z.string().trim().min(2).max(2000)}).strict().parse(value.data) : z.object({conversation_id:z.string().uuid(), message_ids:z.array(z.string().uuid()).max(200)}).strict().parse(value.data);
      const r = await db.rpc("coach_conversation_command", { p_action:value.action,p_data:data,p_key:value.key });
      if(r.error) throw databaseError(r.error);
      return ok(r.data);
    }
    if (endpoint !== "commands") throw new AppError("not_found", "Not found.", 404);
    const body = memberCommand.parse(await input(request));
    const base = ["family.create", "family.update", "child.save", "child.sport", "consent.record"].includes(body.action);
    const operation = ["trial.book", "trial.cancel"].includes(body.action);
    const command = (base ? commandSchema : operation ? operationSchema : productSchema).parse(body);
    if ((base && !mayCommand(account, command.action)) || (operation && !mayOperate(account, command.action))) throw new AppError("forbidden", "Action not permitted.", 403);
    if (!base && !operation) productAccess(account, command.action);
    const result = await rpc.rpc("member_v1_command", { p_action: command.action, p_data: command.data as Json, p_key: body.key });
    if (result.error) throw databaseError(result.error);
    return ok(result.data);
  } catch (error) {
    return failure(error instanceof z.ZodError ? new AppError("validation", "Check the request fields and try again.", 400) : error);
  }
}
