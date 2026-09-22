import { isLocalDemoRuntime } from "@/lib/platform/local-demo";
import { dailyRead, dailyWrite } from "@/lib/platform/daily-server";
import {
  photoInput,
  photoCommand,
} from "@/lib/platform/attendance-photos-server";
import { staffPhotoCommand } from "@/lib/platform/staff-photo-server";
import {
  checkinRehearsalOptions,
  createCheckinRehearsal,
} from "@/lib/platform/checkin-rehearsal-server";
import { attendanceRpc } from "@/lib/platform/attendance-server";
import {
  readAttendance,
  writeAttendance,
} from "@/lib/platform/attendance-server";
import { readPortal } from "@/lib/platform/portal-reads";
import buildProvenance from "@/lib/platform/build-provenance.json";
import { readBusinessReport } from "@/lib/platform/reports-server";
import { administratorVerified } from "@/lib/platform/contracts";
import { readJobStatus } from "@/lib/platform/jobs-server";
import {
  readWorkspaceSearch,
  readSearchRecord,
} from "@/lib/platform/search-server";
import {
  uploadFamilyFile,
  downloadFamilyFile,
} from "@/lib/platform/files-server";
import {
  readProduct,
  productSchema,
  productAccess,
  downloadCertificate,
  downloadInvoice,
  downloadReceipt,
  downloadReport,
} from "@/lib/platform/product-server";
import {
  rememberGuestEnquiry,
  ownsGuestEnquiry,
} from "@/lib/platform/enquiry-cookie";
import { operationSchema, mayOperate } from "@/lib/platform/operations";
import { z } from "zod";
import {
  sessionClient,
  privilegedClient,
  context,
  config,
  AppError,
  checkOrigin,
  input,
  limit,
  ok,
  failure,
  databaseError,
} from "@/lib/platform/server";
import {
  enquirySchema,
  commandSchema,
  workspaceFor,
  mayCommand,
} from "@/lib/platform/contracts";
import type { Json } from "@/lib/platform/database.types";
export const dynamic = "force-dynamic";
const email = z.string().trim().email().max(254),
  password = z.string().min(12).max(128);

async function execute(request: Request) {
  try {
    const path = new URL(request.url).pathname.replace(/^\/api\//, "");
    const db = await sessionClient();
    if (request.method === "GET") {
      if (path === "locations") {
        const { data, error } = await db.rpc("confirmed_locations");
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "children") {
        const u = await db.auth.getUser();
        if (!u.data.user) return ok([]);
        await context(db);
        const guardians = await db
          .from("guardians")
          .select("family_id")
          .eq("user_id", u.data.user.id);
        const { data, error } = await db
          .from("children")
          .select("*")
          .in(
            "family_id",
            (guardians.data || []).map((g) => g.family_id),
          );
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "branches") {
        const { data, error } = await db.rpc("branch_preferences");
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "availability") {
        const enquiry = z
          .string()
          .uuid()
          .parse(new URL(request.url).searchParams.get("enquiry"));
        const guest = await ownsGuestEnquiry(enquiry);
        const result = guest
          ? await privilegedClient().rpc("guest_trial", { p_enquiry: enquiry })
          : (await context(db),
            await db.rpc("trial_availability", { p_enquiry: enquiry }));
        if (result.error) throw databaseError(result.error);
        return ok(result.data);
      }
      const { account, user } = await context(db);
      if (path === "daily")
        return ok(await dailyRead(db, new URL(request.url).searchParams));
      if (path === "checkin-rehearsal")
        return ok(await checkinRehearsalOptions(db));
      if (path === "release")
        return ok({
          sourceSha256: buildProvenance.sourceSha256,
          gitHead: buildProvenance.gitHead,
          dirty: buildProvenance.dirty,
          builtAt: buildProvenance.createdAt,
          expectedMigrations: buildProvenance.expectedMigrations,
        });
      if (path === "auth/session")
        return ok({
          ...account,
          email: user.email,
          destination: workspaceFor(account.roles),
        });
      if (path === "coach-conversations/receipts") {
        const r = await db.rpc("coach_message_receipts", {
          p_conversation: z
            .string()
            .uuid()
            .parse(new URL(request.url).searchParams.get("conversation")),
        });
        if (r.error) throw databaseError(r.error);
        return ok(r.data);
      }
      if (path === "coach-conversations") {
        const result = await db.rpc("coach_conversation_options");
        if (result.error) throw databaseError(result.error);
        return ok(result.data);
      }
      if (path === "reports/summary") {
        productAccess(account, "read");
        return ok(
          await readBusinessReport(db, new URL(request.url).searchParams),
        );
      }
      if (path === "jobs") return ok(await readJobStatus(db));
      if (path === "search/record") {
        return ok(
          await readSearchRecord(db, new URL(request.url).searchParams),
        );
      }
      if (path === "search") {
        return ok(
          await readWorkspaceSearch(db, new URL(request.url).searchParams),
        );
      }
      if (path === "attendance/reference")
        return ok(
          await attendanceRpc(db, "attendance_reference_info", {
            p_child: z
              .string()
              .uuid()
              .parse(new URL(request.url).searchParams.get("child")),
          }),
        );
      if (path === "attendance/photo-scope")
        return ok(
          await attendanceRpc(db, "attendance_photo_scope", {
            p_session: z
              .string()
              .uuid()
              .parse(new URL(request.url).searchParams.get("session")),
          }),
        );
      if (path === "attendance/reviews")
        return ok(
          await attendanceRpc(db, "attendance_reviews", {
            p_session: z
              .string()
              .uuid()
              .parse(new URL(request.url).searchParams.get("session")),
          }),
        );
      if (path === "attendance/register")
        return ok(
          await readAttendance(
            db,
            new URL(request.url).searchParams.get("session"),
          ),
        );
      if (path === "staff-photo") {
        const staff = z.string().uuid().parse(new URL(request.url).searchParams.get("staff"));
        const info = await attendanceRpc(db, "staff_photo_info", { p_staff: staff }) as Record<string, unknown>;
        return ok({ ...info, enabled: isLocalDemoRuntime(process.env.SUPABASE_URL, process.env.APP_URL) && !!process.env.ATTENDANCE_LOCAL_KEY });
      }
      if (path === "portal/revision") {
        const params = new URL(request.url).searchParams;
        const [revision, authority] = await Promise.all([
          readPortal(db, "revision", params),
          readPortal(db, "authority", params),
        ]);
        return ok({ revision, authority, account });
      }
      if (
        [
          "portal/memberships",
          "portal/children",
          "portal/packages",
          "portal/package-branches",
          "portal/calendar",
        ].includes(path)
      ) {
        return ok(
          await readPortal(
            db,
            path.slice(7),
            new URL(request.url).searchParams,
          ),
        );
      }
      if (path === "management/earnings") {
        const p = new URL(request.url).searchParams;
        const { data, error } = await db.rpc("management_earnings", {
          p_coach: p.get("coach")
            ? z.string().uuid().parse(p.get("coach"))
            : undefined,
          p_branch: p.get("branch")
            ? z.string().uuid().parse(p.get("branch"))
            : undefined,
          p_offset: z.coerce
            .number()
            .int()
            .min(0)
            .parse(p.get("offset") || 0),
        });
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "management/invoices") {
        const p = new URL(request.url).searchParams;
        const { data, error } = await db.rpc("management_invoices", {
          p_branch: z.string().uuid().parse(p.get("branch")),
          p_from: z.string().date().parse(p.get("from")),
          p_to: z.string().date().parse(p.get("to")),
          p_offset: z.coerce
            .number()
            .int()
            .min(0)
            .parse(p.get("offset") || 0),
          p_outstanding: p.get("outstanding") === "true",
          p_query: (p.get("q") || "").slice(0, 100),
        });
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "management/invoice") {
        const { data, error } = await db.rpc("management_invoice", {
          p_id: z
            .string()
            .uuid()
            .parse(new URL(request.url).searchParams.get("id")),
        });
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "management/finance") {
        const params = new URL(request.url).searchParams;
        const { data, error } = await db.rpc("management_finance", {
          p_from: z.string().date().parse(params.get("from")),
          p_to: z.string().date().parse(params.get("to")),
          p_branch: z
            .string()
            .uuid()
            .optional()
            .parse(params.get("branch") || undefined),
        });
        if (error) throw databaseError(error);
        return ok(data);
      }
      if (path === "product") {
        productAccess(account, "read");
        const offset = z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .parse(new URL(request.url).searchParams.get("offset") || 0);
        const branch = z
          .string()
          .uuid()
          .optional()
          .parse(new URL(request.url).searchParams.get("branch") || undefined);
        return ok(await readProduct(db, offset, branch));
      }
      if (path === "makeups") {
        productAccess(account, "read");
        const credit = z
          .string()
          .uuid()
          .parse(new URL(request.url).searchParams.get("credit"));
        const result = await db.rpc("makeup_availability", {
          p_credit: credit,
        });
        if (result.error) throw databaseError(result.error);
        return ok(result.data);
      }
      if (path.startsWith("files/")) {
        productAccess(account, "read");
        return await downloadFamilyFile(
          db,
          z.string().uuid().parse(path.slice(6)),
        );
      }
      if (path.startsWith("product/receipts/")) {
        productAccess(account, "read");
        return await downloadReceipt(
          db,
          z.string().uuid().parse(path.slice("product/receipts/".length)),
          new URL(request.url).searchParams.get("locale") === "ar"
            ? "ar"
            : "en",
        );
      }
      if (path.startsWith("product/invoices/")) {
        productAccess(account, "read");
        return await downloadInvoice(
          db,
          z.string().uuid().parse(path.slice("product/invoices/".length)),
          new URL(request.url).searchParams.get("locale") === "ar"
            ? "ar"
            : "en",
        );
      }
      if (path.startsWith("product/reports/")) {
        productAccess(account, "read");
        return await downloadReport(
          db,
          z.string().uuid().parse(path.slice("product/reports/".length)),
          new URL(request.url).searchParams.get("locale") === "ar"
            ? "ar"
            : "en",
        );
      }
      if (path.startsWith("product/certificates/")) {
        productAccess(account, "read");
        return await downloadCertificate(
          db,
          z.string().uuid().parse(path.slice("product/certificates/".length)),
        );
      }
      if (path === "workspace") {
        const branch = z
          .string()
          .uuid()
          .optional()
          .parse(new URL(request.url).searchParams.get("branch") || undefined);
        const tables = [
          "branches",
          "venues",
          "branch_sports",
          "families",
          "family_branches",
          "guardians",
          "children",
          "child_sports",
          "leads",
          "trial_enquiries",
          "lead_activities",
          "consent_records",
          "profiles",
          "role_assignments",
          "branch_permissions",
          "staff_invitations",
          "audit_events",
          "sport_levels",
          "age_groups",
          "academy_classes",
          "class_sessions",
          "trial_bookings",
          "enrollments",
          "session_roster",
          "operation_events",
        ] as const;
        const directory = await db.rpc("staff_directory");
        const [coaches, sessions] = await Promise.all([
          db.rpc("coach_directory"),
          db.rpc("coach_sessions"),
        ]);
        for (const result of [directory, coaches, sessions])
          if (result.error) throw databaseError(result.error);
        const data: Record<string, unknown> = {
          account,
          staff_directory: directory.data,
          coach_directory: coaches.data,
          coach_sessions: sessions.data,
        };
        const offset = z.coerce
          .number()
          .int()
          .min(0)
          .max(100000)
          .parse(new URL(request.url).searchParams.get("offset") || 0);
        let more = false;
        await Promise.all(
          tables.map(async (table) => {
            const order =
              table === "branch_sports"
                ? "branch_id"
                : table === "guardians" || table === "family_branches"
                  ? "family_id"
                  : table === "role_assignments" ||
                      table === "branch_permissions"
                    ? "user_id"
                    : "id";
            const result = branch
              ? await db.rpc("branch_records", {
                  p_table: table,
                  p_branch: branch,
                  p_offset: offset,
                })
              : await db
                  .from(table)
                  .select("*")
                  .order(order)
                  .range(offset, offset + 199);
            if (result.error) throw databaseError(result.error);
            if (Array.isArray(result.data) && result.data.length === 200)
              more = true;
            data[table] = result.data;
          }),
        );
        if (branch) {
          if (Array.isArray(data.staff_directory))
            data.staff_directory = data.staff_directory.filter(
              (p: { branch_id?: string }) => p.branch_id === branch,
            );
          if (Array.isArray(data.coach_directory))
            data.coach_directory = data.coach_directory.filter(
              (p: { branch_ids?: string[] }) => p.branch_ids?.includes(branch),
            );
        }
        data.pagination = [{ offset, more }];
        return ok(data);
      }
      if (path === "auth/mfa") {
        const { data, error } = await db.auth.mfa.listFactors();
        if (error)
          throw new AppError(
            "unavailable",
            "Could not load security settings.",
            503,
          );
        return ok(data);
      }
      throw new AppError("not_found", "Not found.", 404);
    }
    checkOrigin(request);
    if (path === "checkin-rehearsal") {
      await limit(request, "checkin-rehearsal", 20);
      const { user } = await context(db);
      return ok(await createCheckinRehearsal(db, user.id, await input(request)));
    }
    if (path === "attendance/photos") {
      await limit(request, "attendance_photos", 120);
      const { user, account } = await context(db);
      return ok(
        await photoCommand(db, user.id, await photoInput(request), account.aal),
      );
    }
    if (path === "staff-photo") {
      await limit(request, "staff_photo", 60);
      const { user, account } = await context(db);
      return ok(await staffPhotoCommand(db, user.id, account.aal, await photoInput(request)));
    }
    if (path === "attendance/reviews") {
      await context(db);
      const v = z
        .discriminatedUnion("action", [
          z
            .object({
              action: z.literal("request"),
              session: z.string().uuid(),
              roster: z.string().uuid(),
              reason: z.string().trim().min(5).max(500),
              key: z.string().uuid(),
            })
            .strict(),
          z
            .object({ action: z.literal("resolve"), id: z.string().uuid() })
            .strict(),
        ])
        .parse(await input(request));
      return ok(
        v.action === "request"
          ? await attendanceRpc(db, "attendance_request_review", {
              p_session: v.session,
              p_roster: v.roster,
              p_reason: v.reason,
              p_key: v.key,
            })
          : await attendanceRpc(db, "attendance_resolve_review", {
              p_id: v.id,
            }),
      );
    }
    if (path === "attendance/register") {
      await context(db);
      return ok(await writeAttendance(db, await input(request)));
    }
    if (path === "coach-conversations") {
      await limit(request, "coach-conversations", 60);
      await context(db);
      const id = z.string().uuid();
      const command = z
        .object({
          key: id,
          command: z.discriminatedUnion("action", [
            z.object({
              action: z.literal("open"),
              data: z.object({ enrollment_id: id }),
            }),
            z.object({
              action: z.literal("reply"),
              data: z.object({
                conversation_id: id,
                body: z.string().trim().min(2).max(2000),
              }),
            }),
            z.object({
              action: z.literal("publish"),
              data: z.object({ conversation_id: id, id }),
            }),
            z.object({
              action: z.literal("read"),
              data: z.object({
                conversation_id: id,
                message_ids: z.array(id).max(200),
              }),
            }),
            z.object({
              action: z.literal("escalate"),
              data: z.object({ conversation_id: id }),
            }),
            z.object({
              action: z.literal("policy"),
              data: z.object({
                branch_id: id,
                enabled: z.boolean(),
                review_required: z.boolean(),
              }),
            }),
          ]),
        })
        .parse(await input(request));
      const r = await db.rpc("coach_conversation_command", {
        p_action: command.command.action,
        p_data: command.command.data,
        p_key: command.key,
      });
      if (r.error) throw databaseError(r.error);
      return ok(r.data);
    }
    if (path === "development-automation") {
      await context(db);
      const p = z
        .object({
          branch: z.string().uuid(),
          kind: z.enum(["monthly_report", "completion_certificate"]),
          enabled: z.boolean(),
          title: z.string().trim().min(2).max(120),
        })
        .parse(await input(request));
      const r = await db.rpc("development_automation_configure", {
        p_branch: p.branch,
        p_kind: p.kind,
        p_enabled: p.enabled,
        p_title: p.title,
      });
      if (r.error) throw databaseError(r.error);
      return ok({ id: r.data });
    }
    if (path === "registration-link") {
      await limit(request, "registration-link", 30);
      await context(db);
      const command = z
        .discriminatedUnion("action", [
          z.object({
            action: z.literal("issue"),
            data: z.object({ lead_id: z.string().uuid() }),
          }),
          z.object({
            action: z.literal("list"),
            data: z.object({ lead_id: z.string().uuid() }),
          }),
          z.object({
            action: z.literal("revoke"),
            data: z.object({
              lead_id: z.string().uuid(),
              id: z.string().uuid(),
            }),
          }),
          z.object({
            action: z.literal("continue"),
            data: z.object({
              token: z.string().regex(/^[a-f0-9]{64}$/),
              child_id: z.string().uuid(),
            }),
          }),
        ])
        .parse(await input(request));
      const result = await db.rpc("registration_link", {
        p_action: command.action,
        p_data: command.data,
      });
      if (result.error) throw databaseError(result.error);
      return ok(result.data);
    }
    if (path === "files/upload") {
      await limit(request, "file-upload", 20);
      const { account } = await context(db);
      productAccess(account, "files.upload");
      if (Number(request.headers.get("content-length") || 0) > 720000)
        throw new AppError("validation", "File too large.", 413);
      const raw = await request.text();
      if (raw.length > 720000)
        throw new AppError("validation", "File too large.", 413);
      let value: unknown;
      try {
        value = JSON.parse(raw);
      } catch {
        throw new AppError("validation", "Invalid upload.", 400);
      }
      return ok(await uploadFamilyFile(db, value));
    }
    const body = await input(request);
    if (path.startsWith("auth/")) {
      await limit(request, path, 30);
      if (path === "auth/login") {
        const value = z
          .object({
            identifier: email,
            password: z.string().min(1).max(128),
            remember: z.boolean(),
          })
          .parse(body);
        const client = await sessionClient(value.remember);
        const { error } = await client.auth.signInWithPassword({
          email: value.identifier,
          password: value.password,
        });
        if (error)
          throw new AppError(
            "unauthenticated",
            "Email or password is incorrect, or email verification is required.",
            401,
          );
        const { account } = await context(client);
        return ok({
          ...account,
          role: account.roles[0],
          destination: workspaceFor(account.roles),
        });
      }
      if (path === "auth/signup") {
        const value = z
          .object({
            name: z.string().trim().min(2).max(100),
            mobile: z.string().min(9).max(30),
            email,
            password,
            confirmPassword: z.string(),
          })
          .refine((v) => v.password === v.confirmPassword)
          .parse(body);
        if (process.env.AUTH_EMAIL_ENABLED !== "true")
          throw new AppError(
            "unavailable",
            "Staging email delivery is not configured. Account creation is unavailable.",
            503,
          );
        const { error } = await db.auth.signUp({
          email: value.email,
          password: value.password,
          options: {
            data: { name: value.name, mobile: value.mobile },
            emailRedirectTo: `${config().origin}/auth/confirm`,
          },
        });
        if (error)
          throw new AppError(
            "validation",
            "Account creation could not be completed. Check your details or try recovery.",
            400,
          );
        return ok({ verificationRequired: true });
      }
      if (path === "auth/forgot") {
        const value = z.object({ email }).parse(body);
        if (process.env.AUTH_EMAIL_ENABLED !== "true")
          throw new AppError(
            "unavailable",
            "Staging email delivery is not configured. Recovery email is unavailable.",
            503,
          );
        const { error } = await db.auth.resetPasswordForEmail(value.email, {
          redirectTo: `${config().origin}/auth/confirm?next=reset`,
        });
        if (error)
          throw new AppError(
            "unavailable",
            "Recovery could not be sent. Try again later.",
            503,
          );
        return ok(null);
      }
      if (path === "auth/confirm") {
        const value = z
          .object({
            code: z.string().max(5000).optional(),
            token_hash: z.string().max(500).optional(),
            type: z.enum(["signup", "recovery", "invite", "email"]).optional(),
            access_token: z.string().max(8000).optional(),
            refresh_token: z.string().max(1000).optional(),
          })
          .parse(body);
        const result = value.code
          ? await db.auth.exchangeCodeForSession(value.code)
          : value.token_hash && value.type
            ? await db.auth.verifyOtp({
                token_hash: value.token_hash,
                type: value.type,
              })
            : value.access_token && value.refresh_token
              ? await db.auth.setSession({
                  access_token: value.access_token,
                  refresh_token: value.refresh_token,
                })
              : null;
        if (!result || result.error)
          throw new AppError(
            "validation",
            "This link is invalid or expired. Request a new link.",
            400,
          );
        await context(db);
        return ok(null);
      }
      if (path === "auth/logout") {
        await db.auth.signOut({ scope: "local" });
        return ok(null);
      }
      await context(db);
      if (path === "auth/reset") {
        const v = z
          .object({ password, confirmPassword: z.string() })
          .refine((v) => v.password === v.confirmPassword)
          .parse(body);
        const { error } = await db.auth.updateUser({ password: v.password });
        if (error)
          throw new AppError(
            "validation",
            "Password could not be updated.",
            400,
          );
        await db.auth.signOut({ scope: "global" });
        return ok(null);
      }
      if (path === "auth/mfa/enroll") {
        const { data, error } = await db.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "KAFOU authenticator",
        });
        if (error)
          throw new AppError(
            "validation",
            "Authenticator setup could not start.",
            400,
          );
        return ok(data);
      }
      if (path === "auth/mfa/verify") {
        const v = z
          .object({
            factorId: z.string().uuid(),
            code: z.string().regex(/^\d{6}$/),
          })
          .parse(body);
        const { data, error } = await db.auth.mfa.challengeAndVerify(v);
        if (error)
          throw new AppError(
            "validation",
            "The verification code is incorrect or expired.",
            400,
          );
        return ok({ verified: !!data });
      }
    }
    if (path === "enquiries") {
      await limit(request, "enquiry", 15);
      const value = enquirySchema.parse(body);
      const key = z
        .string()
        .uuid()
        .parse(request.headers.get("idempotency-key"));
      const user = await db.auth.getUser();
      const client = user.data.user
        ? (await context(db)).db
        : privilegedClient();
      const { data, error } = await client.rpc("submit_enquiry", {
        p_data: value as Json,
        p_key: key,
      });
      if (error) throw databaseError(error);
      if (!user.data.user)
        await rememberGuestEnquiry((data as { requestId: string }).requestId);
      return ok(data);
    }
    if (path === "operations" && body?.action === "trial.book") {
      const value = operationSchema.parse(body);
      if (
        value.action === "trial.book" &&
        (await ownsGuestEnquiry(value.data.enquiry_id))
      ) {
        await limit(request, "guest-booking", 20);
        const { data, error } = await privilegedClient().rpc("guest_trial", {
          p_enquiry: value.data.enquiry_id,
          p_session: value.data.session_id,
        });
        if (error) throw databaseError(error);
        return ok(data);
      }
    }
    const { account } = await context(db);
    if (path === "daily") {
      await limit(request, "daily", 200);
      return ok(await dailyWrite(db, body));
    }
    if (path === "product") {
      await limit(request, "product", 200);
      const command = productSchema.parse(body);
      const key = z.string().uuid().parse(body.key);
      productAccess(account, command.action);
      const result = await db.rpc("product_command", {
        p_action: command.action,
        p_data: command.data as Json,
        p_key: key,
      });
      if (result.error) throw databaseError(result.error);
      return ok(result.data);
    }
    if (path === "operations") {
      await limit(request, "operations", 100);
      const command = operationSchema.parse(body);
      if (!mayOperate(account, command.action))
        throw new AppError(
          "forbidden",
          "You do not have permission for this action.",
          403,
        );
      const { data, error } = await db.rpc("operations_command", {
        p_action: command.action,
        p_data: command.data as Json,
      });
      if (error) throw databaseError(error);
      return ok(data);
    }
    if (path === "commands") {
      const command = commandSchema.parse(body);
      if (!mayCommand(account, command.action))
        throw new AppError(
          "forbidden",
          "You do not have permission for this action.",
          403,
        );
      const { data, error } = await db.rpc("academy_command", {
        p_action: command.action,
        p_data: command.data as Json,
      });
      if (error) throw databaseError(error);
      return ok(data);
    }
    if (path === "staff/invite") {
      if (
        !account.roles.includes("super_admin") ||
        !administratorVerified(account)
      )
        throw new AppError(
          "forbidden",
          "Administrator verification is required.",
          403,
        );
      if (process.env.AUTH_EMAIL_ENABLED !== "true")
        throw new AppError(
          "unavailable",
          "Staging email delivery is not configured. Invitations cannot be sent.",
          503,
        );
      const value = z
        .object({
          email,
          role: z.enum(["super_admin", "admin", "sales", "branch", "coach"]),
          branch_ids: z.array(z.string().uuid()).max(30),
        })
        .parse(body);
      const { data, error } = await db.rpc("academy_command", {
        p_action: "invitation.create",
        p_data: value,
      });
      if (error) throw databaseError(error);
      const invitationId = (data as { id: string }).id;
      const admin = privilegedClient();
      const invitation = await admin.auth.admin.inviteUserByEmail(value.email, {
        redirectTo: `${config().origin}/auth/confirm?invitation=${invitationId}`,
      });
      if (invitation.error || !invitation.data.user) {
        await admin
          .from("staff_invitations")
          .update({ revoked_at: new Date().toISOString() })
          .eq("id", invitationId);
        throw new AppError(
          "conflict",
          "Invitation could not be sent. The email may already have an account.",
          409,
        );
      }
      const linked = await admin
        .from("staff_invitations")
        .update({ auth_user_id: invitation.data.user.id })
        .eq("id", invitationId);
      if (linked.error) throw databaseError(linked.error);
      return ok({ id: invitationId });
    }
    throw new AppError("not_found", "Not found.", 404);
  } catch (error) {
    if (error instanceof z.ZodError)
      return failure(
        new AppError("validation", "Check the information and try again.", 400),
      );
    return failure(error);
  }
}
export const GET = execute;
export const POST = execute;
