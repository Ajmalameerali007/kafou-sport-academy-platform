// Real signed-in actors exercise domain commands; one guarded helper prepares an unstarted trial occurrence only.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  fixtureId,
  loadFixtureConfig,
  readFixture,
  saveFixture,
  signInActor,
  unwrap,
  safeError,
  prepareTrialOccurrence,
} from "./seed-product-demo.mjs";

export async function productWalkthrough() {
  if (process.argv.includes("--help")) {
    console.log(
      "Usage: node --env-file=.env.test.private scripts/product-walkthrough.mjs [--batch=NAME]\nRun the guarded seed first. Requires privately supplied KAFOU_DEMO_PASSWORD and the same setup credentials for one new unstarted synthetic trial occurrence. The same exact local/staging guards apply. Optional KAFOU_PRODUCT_APP_URL=http://127.0.0.1:3101 verifies the public enquiry endpoint and certificate PDF access boundaries. All domain transitions use distinct authenticated actors with no MFA bypass.",
    );
    return;
  }
  const config = loadFixtureConfig(process.argv.slice(2), true);
  const fixture = readFixture(config);
  assert.equal(fixture.status, "ready", "Fixture setup must have finished");
  // Never send demo credentials to an arbitrary caller-provided site.
  const appUrl = process.env.KAFOU_PRODUCT_APP_URL;
  if (appUrl) {
    const allowed = config.hosted
      ? []
      : ["http://127.0.0.1:3101", "http://localhost:3100"];
    if (!allowed.includes(appUrl))
      throw new Error(
        "App URL rejected: HTTP checks currently support only the known local app origins",
      );
  }
  const reportFile = resolve(
    config.directory,
    `${config.hosted ? "staging" : "local"}-${config.batch}-walkthrough.json`,
  );
  const report = {
    version: 1,
    target: config.hosted ? "synthetic-staging" : "local",
    batch: config.batch,
    startedAt: new Date().toISOString(),
    status: "running",
    transport: "authenticated Supabase RPC and RLS reads",
    checks: [],
    ids: {},
    app: {
      status: appUrl ? "pending" : "not_run",
      reason: appUrl
        ? undefined
        : "KAFOU_PRODUCT_APP_URL was not supplied; no PDF download claim",
    },
  };
  const actors = {},
    http = [];
  const key = (step) =>
    fixtureId(`${config.url}/${config.batch}/walkthrough/${step}`);
  let step = "authenticate";
  const checkpoint = () => saveFixture(reportFile, report);
  const pass = (name, evidence = {}) => {
    report.checks.push({ name, ...evidence });
    checkpoint();
  };
  const query = async (role, table, column, value) =>
    unwrap(
      actors[role].client.from(table).select("*").eq(column, value),
      `Read ${table} as ${role}`,
    );
  const command = async (role, action, data, label) => {
    step = label;
    const result = await unwrap(
      actors[role].client.rpc("product_command", {
        p_action: action,
        p_data: data,
        p_key: key(label),
      }),
      `${role} ${action}`,
    );
    assert.ok(
      result && (result.id || result.saved),
      `Command ${label} must return a durable result`,
    );
    report.ids[label] = result.id;
    fixture.workflow = { ...fixture.workflow, [label]: result.id };
    saveFixture(config.file, fixture);
    checkpoint();
    return result;
  };
  const deny = async (role, action, data, label) => {
    step = label;
    const result = await actors[role].client.rpc("product_command", {
      p_action: action,
      p_data: data,
      p_key: key(label),
    });
    assert.equal(
      result.error?.code,
      "42501",
      `${label} must reject unauthorized actor`,
    );
    pass(label, { actor: role, code: result.error.code });
  };
  try {
    for (const [role, account] of Object.entries(fixture.accounts))
      actors[role] = await signInActor(config, account);
    pass("six_existing_accounts_authenticated", {
      roles: Object.keys(actors),
      privileged_workflow_actor: "admin with explicit product grants",
    });
    await command(
      "admin",
      "academy.policy",
      {
        branch_id: fixture.branchId,
        name: `DEMO PRODUCT · ${config.batch} · Makeup`,
        makeup_days: 30,
        allow_absent: false,
      },
      "makeup_policy",
    );
    const pkg = await command(
      "admin",
      "commercial.package.create",
      {
        branch_id: fixture.branchId,
        sport: "swimming",
        level_id: fixture.levelId,
        name: `DEMO PRODUCT · ${config.batch}`,
        name_ar: "باقة سباحة تجريبية",
        price_minor: 25010,
        session_allowance: 8,
        terms:
          "Synthetic monthly policy: eight ordinary sessions; excused absence consumes the ordinary entitlement and may grant one replacement. No real payment was collected.",
        terms_ar: "سياسة تجريبية شهرية لثماني حصص. لا تمثل دفعة مالية حقيقية.",
      },
      "package",
    );
    const membership = await command(
      "parent",
      "commercial.membership.start",
      {
        child_id: fixture.ids.child,
        package_id: pkg.id,
        starts_on: fixture.startsOn,
        accepted: true,
      },
      "membership",
    );
    const invoices = await query(
      "parent",
      "commercial_invoices",
      "membership_id",
      membership.id,
    );
    assert.equal(
      invoices.length,
      1,
      "Exactly one invoice is created for the membership",
    );
    const invoice = invoices[0];
    report.ids.invoice = invoice.id;
    const paymentData = {
      family_id: fixture.familyId,
      branch_id: fixture.branchId,
      amount_minor: 25010,
      method: "cash",
      reference: `SYNTHETIC-${config.batch}-OFFLINE`,
      invoice_id: invoice.id,
    };
    await deny(
      "sales",
      "commercial.payment.record",
      paymentData,
      "sales_payment_denied",
    );
    await deny(
      "coach",
      "commercial.payment.record",
      paymentData,
      "coach_payment_denied",
    );
    const payment = await command(
      "admin",
      "commercial.payment.record",
      paymentData,
      "payment",
    );
    const replay = await command(
      "admin",
      "commercial.payment.record",
      paymentData,
      "payment",
    );
    assert.equal(
      replay.id,
      payment.id,
      "Exact payment retry returns the original payment",
    );
    const [payments, receipts, lines, allocations, members, reserved] =
      await Promise.all([
        query("parent", "commercial_payments", "id", payment.id),
        query("parent", "commercial_receipts", "payment_id", payment.id),
        query("parent", "commercial_invoice_lines", "invoice_id", invoice.id),
        query("parent", "commercial_allocations", "invoice_id", invoice.id),
        query("parent", "commercial_memberships", "id", membership.id),
        query("parent", "entitlement_ledger", "membership_id", membership.id),
      ]);
    assert.equal(payments.length, 1);
    assert.equal(payments[0].recorded_by, fixture.accounts.admin.id);
    assert.equal(receipts.length, 1);
    assert.equal(
      lines.reduce((n, x) => n + x.quantity * x.unit_minor, 0) -
        allocations.reduce((n, x) => n + x.amount_minor, 0),
      0,
      "Invoice paid exactly in integer minor units",
    );
    assert.equal(members[0].status, "active");
    assert.equal(
      reserved.filter((x) => x.kind === "grant").length,
      1,
      "One entitlement grant despite payment retry",
    );
    assert.equal(
      reserved
        .filter((x) => x.roster_id === fixture.ids.roster.ordinary)
        .reduce((n, x) => n + x.reserved_delta, 0),
      1,
      "Activation reserves existing future roster",
    );
    for (const role of ["sales", "coach"])
      assert.equal(
        (await query(role, "commercial_invoices", "id", invoice.id)).length,
        0,
        `${role} has no invoice visibility`,
      );
    pass("paid_membership_receipt_allocation_and_retry", {
      membership_id: membership.id,
      invoice_id: invoice.id,
      receipt_id: receipts[0].id,
      amount_minor: 25010,
      balance_minor: 0,
    });

    for (const [name, attendance] of [
      ["absence", "excused"],
      ["assessment", "present"],
    ]) {
      step = `finalize_${name}`;
      let session = (
        await query(
          "branch",
          "class_sessions",
          "id",
          fixture.ids.sessions[name],
        )
      )[0];
      assert.ok(session, "Branch can see the fixture session");
      if (!session.finalized_at)
        await unwrap(
          actors.branch.client.rpc("operations_command", {
            p_action: "attendance.finalize",
            p_data: {
              session_id: session.id,
              entries: [{ id: fixture.ids.roster[name], attendance }],
            },
          }),
          step,
        );
      session = (await query("branch", "class_sessions", "id", session.id))[0];
      const roster = (
        await query("branch", "session_roster", "id", fixture.ids.roster[name])
      )[0];
      assert.ok(session.finalized_at);
      assert.equal(session.finalized_by, fixture.accounts.branch.id);
      assert.equal(roster.attendance, attendance);
    }
    const credits = await query(
      "parent",
      "makeup_credits",
      "source_roster_id",
      fixture.ids.roster.absence,
    );
    assert.equal(
      credits.length,
      1,
      "One finalized excused absence creates exactly one credit",
    );
    const credit = credits[0];
    report.ids.credit = credit.id;
    step = "makeup_availability";
    if (credit.status === "available") {
      const available = await unwrap(
        actors.parent.client.rpc("makeup_availability", {
          p_credit: credit.id,
        }),
        step,
      );
      assert.ok(
        available.some((x) => x.id === fixture.ids.sessions.makeup),
        "Compatible future session is actually offered",
      );
      pass("compatible_makeup_availability", {
        credit_id: credit.id,
        session_id: fixture.ids.sessions.makeup,
      });
    } else
      assert.equal(
        credit.status,
        "reserved",
        "Repeated walkthrough expects its reserved credit",
      );
    const booking = await command(
      "parent",
      "academy.makeup.book",
      { credit_id: credit.id, session_id: fixture.ids.sessions.makeup },
      "makeup_booking",
    );
    const again = await command(
      "parent",
      "academy.makeup.book",
      { credit_id: credit.id, session_id: fixture.ids.sessions.makeup },
      "makeup_booking",
    );
    assert.equal(again.id, booking.id);
    assert.equal(
      (await query("parent", "makeup_bookings", "credit_id", credit.id)).filter(
        (x) => x.status !== "cancelled",
      ).length,
      1,
    );
    const ledger = await query(
      "parent",
      "entitlement_ledger",
      "membership_id",
      membership.id,
    );
    assert.equal(
      ledger.reduce((n, x) => n + x.consumed_delta, 0),
      2,
      "Two ordinary finalized sessions consume exactly two units",
    );
    assert.equal(
      ledger.reduce((n, x) => n + x.reserved_delta, 0),
      1,
      "Makeup reservation does not consume another ordinary entitlement",
    );
    pass("finalized_absence_and_idempotent_makeup_booking", {
      credit_id: credit.id,
      booking_id: booking.id,
      ordinary_consumed: 2,
      ordinary_reserved: 1,
    });

    await command(
      "coach",
      "academy.session.complete",
      { session_id: fixture.ids.sessions.assessment },
      "delivered_session",
    );
    const coachSessions = await unwrap(
      actors.coach.client.rpc("development_sessions"),
      "Read assigned coach session projection",
    );
    assert.ok(
      coachSessions.some(
        (x) => x.id === fixture.ids.sessions.assessment && x.can_coach,
      ),
      "Session is in the assigned coach projection",
    );
    const delivered = (
      await query(
        "branch",
        "class_sessions",
        "id",
        fixture.ids.sessions.assessment,
      )
    )[0];
    assert.ok(delivered.delivered_at);
    assert.equal(delivered.delivered_by, fixture.accounts.coach.id);
    assert.equal(delivered.finalized_by, fixture.accounts.branch.id);
    const criteria = await command(
      "admin",
      "development.criteria.create",
      {
        sport: "swimming",
        level_id: fixture.levelId,
        title: `DEMO PRODUCT · ${config.batch} · Floating`,
        criteria: [
          {
            key: "float_seconds",
            label: "Independent float",
            label_ar: "الطفو المستقل",
            unit: "seconds",
            min: 0,
            max: 120,
            direction: "higher",
          },
        ],
      },
      "criteria",
    );
    await command(
      "coach",
      "development.plan.save",
      {
        session_id: fixture.ids.sessions.assessment,
        objectives: "Synthetic demonstration: develop confidence in floating.",
        activities:
          "Synthetic warm-up, supported float and timed independent float.",
        internal_note:
          "Synthetic staff-only planning note; never shown to guardians.",
      },
      "session_plan",
    );
    const assessment = await command(
      "coach",
      "development.assessment.save",
      {
        session_id: fixture.ids.sessions.assessment,
        child_id: fixture.ids.child,
        criteria_id: criteria.id,
        scores: { float_seconds: 12 },
        summary:
          "Synthetic assessment: maintained an independent float for 12 seconds.",
        internal_note:
          "Synthetic confidential coach note for independent staff review.",
      },
      "assessment",
    );
    const current = (
      await query("coach", "development_assessments", "id", assessment.id)
    )[0];
    if (current.status === "draft") {
      assert.equal(
        (await query("parent", "development_assessments", "id", assessment.id))
          .length,
        0,
        "Draft is invisible to parent",
      );
      pass("unpublished_assessment_hidden_from_parent");
    } else
      pass("assessment_lifecycle_replayed", {
        status: current.status,
        note: "Draft visibility was not rechecked after the original transition",
      });
    await command(
      "coach",
      "development.assessment.submit",
      { id: assessment.id },
      "assessment_submit",
    );
    await command(
      "admin",
      "development.assessment.review",
      {
        id: assessment.id,
        decision: "approved",
        reason:
          "Synthetic independent review: scores are supported by the recorded session evidence.",
      },
      "assessment_review",
    );
    await command(
      "admin",
      "development.assessment.publish",
      { id: assessment.id },
      "assessment_publish",
    );
    const published = await query(
      "parent",
      "development_assessments",
      "id",
      assessment.id,
    );
    assert.equal(published[0]?.status, "published");
    assert.equal(published[0].author_id, fixture.accounts.coach.id);
    assert.equal(published[0].reviewed_by, fixture.accounts.admin.id);
    assert.equal(
      (
        await query(
          "parent",
          "development_assessment_notes",
          "assessment_id",
          assessment.id,
        )
      ).length,
      0,
      "Private coach note remains hidden after publication",
    );
    const results = await query(
      "parent",
      "development_results",
      "assessment_id",
      assessment.id,
    );
    assert.equal(results.length, 1);
    assert.equal(Number(results[0].value), 12);
    assert.equal(results[0].unit, "seconds");
    const certificate = await command(
      "admin",
      "development.certificate.issue",
      {
        assessment_id: assessment.id,
        title: "Synthetic swimming progress · تقدم السباحة التجريبي",
      },
      "certificate",
    );
    assert.equal(
      (await query("parent", "development_certificates", "id", certificate.id))
        .length,
      1,
    );
    pass("coach_evidence_independent_review_publication_and_certificate", {
      assessment_id: assessment.id,
      certificate_id: certificate.id,
      parent_private_notes: 0,
    });

    const ticket = await command(
      "parent",
      "community.ticket.open",
      {
        family_id: fixture.familyId,
        branch_id: fixture.branchId,
        child_id: fixture.ids.child,
        session_id: fixture.ids.sessions.ordinary,
        invoice_id: invoice.id,
        subject: `DEMO PRODUCT · ${config.batch} · Makeup support`,
        message:
          "Synthetic parent question: please confirm the replacement session and the offline payment receipt.",
      },
      "support_ticket",
    );
    await command(
      "branch",
      "community.ticket.reply",
      {
        id: ticket.id,
        message:
          "Synthetic reception response: your replacement appears in the schedule. Your recorded offline receipt is available in Finance.",
      },
      "support_reply",
    );
    const messages = await query(
      "parent",
      "support_messages",
      "ticket_id",
      ticket.id,
    );
    assert.equal(messages.length, 2);
    assert.ok(messages.some((x) => x.author_id === fixture.accounts.branch.id));
    assert.ok(messages.some((x) => x.author_id === fixture.accounts.parent.id));
    const events = await query(
      "parent",
      "product_events",
      "family_id",
      fixture.familyId,
    );
    const eventIds = events
      .filter((e) =>
        [
          payment.id,
          credit.id,
          booking.id,
          assessment.id,
          report.ids.support_reply,
        ].includes(e.entity_id),
      )
      .map((e) => e.id);
    const notifications = await unwrap(
      actors.parent.client
        .from("notifications")
        .select("*")
        .in("event_id", eventIds),
      "Read parent workflow notifications",
    );
    assert.ok(notifications.some((n) => n.title === "Support response"));
    assert.ok(notifications.some((n) => n.title === "New progress assessment"));
    assert.ok(
      notifications.some((n) => n.title === "Payment receipt available"),
    );
    const outbox = await unwrap(
      actors.parent.client
        .from("delivery_outbox")
        .select("id,status")
        .in("event_id", eventIds),
      "Read actual delivery configuration",
    );
    assert.ok(outbox.length > 0);
    assert.ok(
      outbox.every((x) => x.status === "not_configured"),
      "No external delivery is represented as sent",
    );
    pass("support_reply_and_private_notifications", {
      ticket_id: ticket.id,
      message_count: 2,
      notification_count: notifications.length,
      external_delivery: "not_configured",
    });

    step = "parent_trial_child";
    const childName = `DEMO PRODUCT · ${config.batch} · Trial child`;
    let trialChild = (
      await unwrap(
        actors.parent.client
          .from("children")
          .select("*")
          .eq("family_id", fixture.familyId)
          .eq("name", childName),
        "Find owned trial child",
      )
    )[0];
    if (!trialChild) {
      const created = await unwrap(
        actors.parent.client.rpc("academy_command", {
          p_action: "child.save",
          p_data: {
            family_id: fixture.familyId,
            name: childName,
            reported_age: 7,
          },
        }),
        "Parent creates trial child",
      );
      trialChild = (await query("parent", "children", "id", created.id))[0];
    }
    assert.equal(trialChild.family_id, fixture.familyId);
    report.ids.trial_child = trialChild.id;
    step = "public_parent_enquiry";
    const enquiryPayload = {
      parentName: `DEMO PRODUCT · ${config.batch} · Parent`,
      mobile: "+971500000000",
      email: fixture.accounts.parent.email,
      childName,
      age: "7",
      sport: "swimming",
      preferredBranch: "demo-dubai",
      experience: "beginner",
      childId: trialChild.id,
    };
    let enquiryResult;
    if (appUrl) {
      const { request } = await import("@playwright/test");
      const parentHttp = await request.newContext({
        baseURL: appUrl,
        extraHTTPHeaders: { Origin: appUrl },
        timeout: 30000,
      });
      http.push(parentHttp);
      const login = await parentHttp.post("/api/auth/login", {
        data: {
          identifier: fixture.accounts.parent.email,
          password: config.password,
          remember: false,
        },
      });
      assert.equal(
        login.status(),
        200,
        "Parent app authentication before enquiry",
      );
      const response = await parentHttp.post("/api/enquiries", {
        headers: { "Idempotency-Key": key("public_parent_enquiry") },
        data: enquiryPayload,
      });
      assert.equal(
        response.status(),
        200,
        "Actual public enquiry endpoint accepts parent submission",
      );
      enquiryResult = (await response.json()).data;
    } else
      enquiryResult = await unwrap(
        actors.parent.client.rpc("submit_enquiry", {
          p_data: enquiryPayload,
          p_key: key("public_parent_enquiry"),
        }),
        "Parent submits public enquiry",
      );
    const trialEnquiry = (
      await query("sales", "trial_enquiries", "id", enquiryResult.requestId)
    )[0];
    assert.ok(trialEnquiry, "Separate Sales actor sees the new enquiry");
    assert.equal(trialEnquiry.child_id, trialChild.id);
    report.ids.trial_enquiry = trialEnquiry.id;
    report.ids.trial_lead = trialEnquiry.lead_id;
    const note = `Synthetic Sales follow-up for ${config.batch}: parent requested a swimming trial.`;
    const activity = await query(
      "sales",
      "lead_activities",
      "lead_id",
      trialEnquiry.lead_id,
    );
    if (
      !activity.some(
        (row) =>
          row.note === note && row.actor_id === fixture.accounts.sales.id,
      )
    )
      await unwrap(
        actors.sales.client.rpc("academy_command", {
          p_action: "lead.note",
          p_data: { id: trialEnquiry.lead_id, note },
        }),
        "Sales records actual follow-up",
      );
    let trialBooking = (
      await query("parent", "trial_bookings", "enquiry_id", trialEnquiry.id)
    ).find((row) => !["cancelled", "missed"].includes(row.status));
    if (!trialBooking) {
      // The single-use authorization code exists in memory only; never write it to evidence.
      const claim = await unwrap(
        actors.parent.client.rpc("operations_command", {
          p_action: "family.claim",
          p_data: { family_id: fixture.familyId },
        }),
        "Parent grants child sharing",
      );
      await unwrap(
        actors.branch.client.rpc("operations_command", {
          p_action: "family.link",
          p_data: {
            enquiry_id: trialEnquiry.id,
            child_id: trialChild.id,
            token: claim.token,
          },
        }),
        "Branch links the parent-authorized child",
      );
    }
    const trialSession = await prepareTrialOccurrence(config, fixture);
    report.ids.trial_session = trialSession.id;
    if (!trialBooking) {
      const available = await unwrap(
        actors.parent.client.rpc("trial_availability", {
          p_enquiry: trialEnquiry.id,
        }),
        "Parent checks real trial eligibility",
      );
      assert.ok(
        available.some((row) => row.id === trialSession.id),
        "Unstarted trial is eligible without an override",
      );
      const bookingResult = await unwrap(
        actors.parent.client.rpc("operations_command", {
          p_action: "trial.book",
          p_data: { enquiry_id: trialEnquiry.id, session_id: trialSession.id },
        }),
        "Parent books eligible trial",
      );
      trialBooking = (
        await query("parent", "trial_bookings", "id", bookingResult.id)
      )[0];
    }
    assert.equal(trialBooking.booked_by, fixture.accounts.parent.id);
    report.ids.trial_booking = trialBooking.id;
    const salesDenied = await actors.sales.client.rpc("operations_command", {
      p_action: "attendance.finalize",
      p_data: { session_id: trialSession.id, entries: [] },
    });
    assert.equal(
      salesDenied.error?.code,
      "42501",
      "Sales cannot finalize trial attendance",
    );
    const untilStart = Date.parse(trialSession.starts_at) - Date.now() + 250;
    assert.ok(
      untilStart < 60000,
      "Synthetic trial wait is bounded below one minute",
    );
    if (untilStart > 0) {
      console.log(
        JSON.stringify({
          status: "waiting_for_actual_trial_start",
          seconds: Math.ceil(untilStart / 1000),
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, untilStart));
    }
    step = "branch_trial_attendance_conversion";
    const currentTrial = (
      await query("branch", "class_sessions", "id", trialSession.id)
    )[0];
    const trialRoster = (
      await query("branch", "session_roster", "session_id", trialSession.id)
    ).filter((row) => !row.cancelled);
    assert.equal(
      trialRoster.length,
      1,
      "Dedicated synthetic trial has one actual booked participant",
    );
    if (!currentTrial.finalized_at)
      await unwrap(
        actors.branch.client.rpc("operations_command", {
          p_action: "attendance.finalize",
          p_data: {
            session_id: trialSession.id,
            entries: [{ id: trialRoster[0].id, attendance: "present" }],
          },
        }),
        "Branch finalizes actual trial attendance",
      );
    const converted = await unwrap(
      actors.branch.client.rpc("operations_command", {
        p_action: "trial.convert",
        p_data: { id: trialBooking.id, class_id: fixture.ids.class },
      }),
      "Branch converts attended trial",
    );
    const actualEnrollment = (
      await query("parent", "enrollments", "id", converted.id)
    )[0];
    assert.equal(actualEnrollment.child_id, trialChild.id);
    assert.equal(actualEnrollment.trial_booking_id, trialBooking.id);
    report.ids.trial_enrollment = converted.id;
    const conversionMembership = await command(
      "parent",
      "commercial.membership.start",
      {
        child_id: trialChild.id,
        package_id: pkg.id,
        starts_on: fixture.startsOn,
        accepted: true,
      },
      "trial_membership",
    );
    const trialInvoice = (
      await query(
        "parent",
        "commercial_invoices",
        "membership_id",
        conversionMembership.id,
      )
    )[0];
    await command(
      "admin",
      "commercial.payment.record",
      {
        family_id: fixture.familyId,
        branch_id: fixture.branchId,
        amount_minor: 25010,
        method: "cash",
        reference: `SYNTHETIC-${config.batch}-TRIAL`,
        invoice_id: trialInvoice.id,
      },
      "trial_payment",
    );
    assert.equal(
      (
        await query(
          "parent",
          "commercial_memberships",
          "id",
          conversionMembership.id,
        )
      )[0].status,
      "active",
    );
    const trialAssessment = await command(
      "coach",
      "development.assessment.save",
      {
        session_id: trialSession.id,
        child_id: trialChild.id,
        criteria_id: criteria.id,
        scores: { float_seconds: 8 },
        summary:
          "Synthetic trial assessment: completed an eight-second independent float.",
        internal_note: "Synthetic staff-only trial observation.",
      },
      "trial_assessment",
    );
    const trialAssessmentState = (
      await query("coach", "development_assessments", "id", trialAssessment.id)
    )[0];
    if (trialAssessmentState.status === "draft")
      assert.equal(
        (
          await query(
            "parent",
            "development_assessments",
            "id",
            trialAssessment.id,
          )
        ).length,
        0,
      );
    await command(
      "coach",
      "development.assessment.submit",
      { id: trialAssessment.id },
      "trial_assessment_submit",
    );
    await command(
      "admin",
      "development.assessment.review",
      {
        id: trialAssessment.id,
        decision: "approved",
        reason:
          "Synthetic independent review of the recorded trial observation.",
      },
      "trial_assessment_review",
    );
    await command(
      "admin",
      "development.assessment.publish",
      { id: trialAssessment.id },
      "trial_assessment_publish",
    );
    assert.equal(
      (
        await query(
          "parent",
          "development_assessments",
          "id",
          trialAssessment.id,
        )
      )[0].status,
      "published",
    );
    assert.equal(
      (
        await query(
          "parent",
          "development_assessment_notes",
          "assessment_id",
          trialAssessment.id,
        )
      ).length,
      0,
    );
    pass(
      "real_parent_enquiry_sales_followup_trial_conversion_and_paid_membership",
      {
        child_id: trialChild.id,
        enquiry_id: trialEnquiry.id,
        trial_booking_id: trialBooking.id,
        enrollment_id: converted.id,
        membership_id: conversionMembership.id,
        assessment_id: trialAssessment.id,
        attendance_actor: "branch",
        author: "coach",
        reviewer: "admin",
        external_payment: "synthetic offline acknowledgement",
        trial_delivery: "not claimed; occurrence has started but not ended",
      },
    );

    if (appUrl) {
      step = "authenticated_certificate_pdf";
      const { request } = await import("@playwright/test");
      const appContext = async (role) => {
        const context = await request.newContext({
          baseURL: appUrl,
          extraHTTPHeaders: { Origin: appUrl },
          timeout: 30000,
        });
        http.push(context);
        const login = await context.post("/api/auth/login", {
          data: {
            identifier: fixture.accounts[role].email,
            password: config.password,
            remember: false,
          },
        });
        if (login.status() !== 200)
          throw safeError(`App login ${role}`, { status: login.status() });
        return context;
      };
      const parentApp = await appContext("parent");
      const productResponse = await parentApp.get("/api/product");
      assert.equal(
        productResponse.status(),
        200,
        "Parent integrated product endpoint succeeds",
      );
      const productEnvelope = await productResponse.json();
      const product = productEnvelope.data;
      assert.ok(
        product.commercial_memberships.some((x) => x.id === membership.id),
      );
      assert.ok(
        product.development_assessments.some(
          (x) => x.id === assessment.id && x.status === "published",
        ),
      );
      assert.equal(
        product.development_assessment_notes.length,
        0,
        "Integrated response does not expose private coach notes",
      );
      assert.ok(product.support_tickets.some((x) => x.id === ticket.id));
      const pdf = await parentApp.get(
        `/api/product/certificates/${certificate.id}`,
      );
      assert.equal(
        pdf.status(),
        200,
        "Parent certificate HTTP download succeeds",
      );
      assert.match(pdf.headers()["content-type"] ?? "", /application\/pdf/);
      const bytes = await pdf.body();
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.ok(bytes.length > 1000);
      const pdfPath = resolve(
        config.directory,
        `${config.hosted ? "staging" : "local"}-${config.batch}-certificate.pdf`,
      );
      writeFileSync(pdfPath, bytes, { mode: 0o600 });
      const anonymous = await request.newContext({ baseURL: appUrl });
      http.push(anonymous);
      assert.equal(
        (
          await anonymous.get(`/api/product/certificates/${certificate.id}`)
        ).status(),
        401,
        "Anonymous download denied",
      );
      const salesApp = await appContext("sales");
      assert.ok(
        [403, 404].includes(
          (
            await salesApp.get(`/api/product/certificates/${certificate.id}`)
          ).status(),
        ),
        "Sales download denied",
      );
      report.app = {
        status: "passed",
        origin: appUrl,
        parent_product: "passed",
        parent_pdf: pdfPath,
        bytes: bytes.length,
        anonymous: "denied",
        sales: "denied",
      };
      pass("real_http_certificate_authorization_and_pdf");
    }
    report.status = "passed";
    report.completedAt = new Date().toISOString();
    checkpoint();
    console.log(
      JSON.stringify({
        status: report.status,
        target: report.target,
        batch: config.batch,
        checks: report.checks.length,
        evidence: reportFile,
        app: report.app.status,
        ids: report.ids,
      }),
    );
  } catch (error) {
    report.status = "failed";
    report.failedStep = step;
    // Persist only our own controlled assertion/context message, never request headers or sessions.
    report.error =
      error instanceof Error ? error.message : "Walkthrough failed";
    checkpoint();
    throw new Error(`Walkthrough stopped at ${step}: ${report.error}`);
  } finally {
    await Promise.allSettled(
      Object.values(actors).map(({ client }) =>
        client.auth.signOut({ scope: "local" }),
      ),
    );
    await Promise.allSettled(http.map((context) => context.dispose()));
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
)
  productWalkthrough().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Walkthrough failed",
    );
    process.exitCode = 1;
  });
