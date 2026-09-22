"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import type { AccountContext } from "@/lib/platform/contracts";
import {
  type PortalData,
  type PortalRow,
  records,
  value,
} from "@/lib/platform/portal-model";
import { api } from "@/lib/platform/client";
import { money } from "@/lib/platform/commercial";
import { PortalDrawer, StatusBadge } from "./portal-ui";
import { Field, ManagementForm, string } from "./management-ui";
import { StaffPhotoApproval } from "./staff-face-checkin";
export function CoachManagement({
  data,
  account,
  refresh,
  branch,
  navigate,
}: {
  data: PortalData;
  account: AccountContext;
  refresh: () => void;
  branch: string;
  navigate: (s: string) => void;
}) {
  const { t, locale } = useLocale();
  const [q, setQ] = useState(""),
    [selected, setSelected] = useState(""),
    [tab, setTab] = useState("Profile"),
    [chosenBranch, setChosenBranch] = useState(branch);
  const head = account.roles.some((r) => ["super_admin", "admin"].includes(r));
  const owner = account.roles.includes("super_admin");
  const coachIds = new Set([
    ...records(data, "role_assignments")
      .filter((r) => r.role === "coach")
      .map((r) => r.user_id),
    ...records(data, "coach_directory").map((r) => r.id),
    ...records(data, "coach_assignments").map((r) => r.coach_id),
  ]);
  const profiles = [
    ...new Map(
      [...records(data, "coach_directory"), ...records(data, "profiles")].map(
        (p) => [p.id, p],
      ),
    ).values(),
  ];
  const coaches = profiles.filter(
    (p) =>
      coachIds.has(p.id) &&
      value(p, "name").toLowerCase().includes(q.toLowerCase()),
  );
  const coach = profiles.find((p) => p.id === selected);
  const assignments = records(data, "coach_assignments").filter(
    (a) => a.coach_id === selected,
  );
  const rates = records(data, "commercial_compensation_rates").filter(
    (a) => a.coach_id === selected,
  );
  const classes = records(data, "academy_classes").filter(
    (c) => c.coach_id === selected,
  );
  const branches = records(data, "branches");
  const label = (id: unknown) =>
    value(branches.find((b) => b.id === id) || {}, "name");
  return (
    <section className="management-workspace">
      <div className="management-toolbar">
        <label>
          {t("Search coaches")}
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {owner && (
          <button className="portal-primary" onClick={() => navigate("Team")}>
            {t("Add coach / invite account")}
          </button>
        )}
      </div>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th>{t("Coach")}</th>
              <th>{t("Branches")}</th>
              <th>{t("Compensation basis")}</th>
              <th>{t("Status")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {coaches.map((c) => (
              <tr key={value(c, "id")}>
                <td>
                  <strong>{value(c, "name")}</strong>
                  <small>{value(c, "mobile")}</small>
                </td>
                <td>
                  {records(data, "branch_permissions")
                    .filter((a) => a.user_id === c.id)
                    .map((a) => label(a.branch_id))
                    .join(" · ")}
                </td>
                <td>
                  {[
                    ...new Set(
                      records(data, "commercial_compensation_rates")
                        .filter((a) => a.coach_id === c.id)
                        .map((a) => t(value(a, "basis"))),
                    ),
                  ].join(" · ") || "—"}
                </td>
                <td>
                  <StatusBadge status={c.active ? "active" : "inactive"} />
                </td>
                <td>
                  <button
                    className="portal-link"
                    onClick={() => {
                      setSelected(value(c, "id"));
                      setTab("Profile");
                      setChosenBranch(branch);
                    }}
                  >
                    {t("Manage coach")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!coaches.length && <p>{t("No matching records")}</p>}
      </div>
      <PortalDrawer
        open={Boolean(coach)}
        onClose={() => setSelected("")}
        title={coach ? value(coach, "name") : t("Coach")}
      >
        {coach && (
          <>
            <nav className="management-tabs" aria-label={t("Coach management")}>
              {["Profile", "Assignments", "Agreements", "Earnings and payments"]
                .filter(
                  (x) =>
                    head ||
                    !["Agreements", "Earnings and payments"].includes(x),
                )
                .map((s) => (
                  <button
                    aria-pressed={tab === s}
                    key={s}
                    onClick={() => setTab(s)}
                  >
                    {t(s)}
                  </button>
                ))}
            </nav>
            {tab === "Profile" && (
              <>
                {owner ? (
                  <ManagementForm
                    key={selected}
                    title="Coach details"
                    action="commercial.coach.save"
                    refresh={refresh}
                    build={(f) => ({
                      id: selected,
                      name: string(f, "name"),
                      mobile: string(f, "mobile"),
                      active: f.get("active") === "on",
                    })}
                  >
                    <Field
                      label="Name"
                      name="name"
                      value={value(coach, "name")}
                      required
                    />
                    <Field
                      label="Mobile"
                      name="mobile"
                      value={value(coach, "mobile")}
                    />
                    <label className="management-check">
                      <input
                        name="active"
                        type="checkbox"
                        defaultChecked={Boolean(coach.active)}
                      />
                      {t("Account active")}
                    </label>
                    <p>
                      {t(
                        "Deactivation preserves history. Future classes must be reassigned.",
                      )}
                    </p>
                  </ManagementForm>
                ) : (
                  <p>
                    {value(coach, "name")} · {value(coach, "mobile")}
                  </p>
                )}
                <StaffPhotoApproval staff={selected} onSaved={refresh} />
                <h3>{t("Weekly availability")}</h3>
                {records(data, "coach_availability")
                  .filter((a) => a.coach_id === selected)
                  .map((a) => (
                    <p key={value(a, "id")}>
                      {
                        [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ][Number(a.weekday)]
                      }{" "}
                      · {value(a, "start_time")}–{value(a, "end_time")}
                    </p>
                  ))}
                <h3>{t("Classes")}</h3>
                {classes.map((c) => (
                  <div className="management-row" key={value(c, "id")}>
                    <span>
                      {value(c, "name")} · {label(c.branch_id)}
                      {!coach.active && Boolean(c.active) && (
                        <strong className="management-warning">
                          {t("Reassignment required")}
                        </strong>
                      )}
                    </span>
                    <button
                      className="portal-link"
                      onClick={() => {
                        setSelected("");
                        navigate("Classes / Sessions");
                      }}
                    >
                      {t("Manage classes")}
                    </button>
                  </div>
                ))}
              </>
            )}
            {tab === "Assignments" && (
              <>
                {assignments.map((a) => (
                  <p key={value(a, "id")}>
                    {label(a.branch_id)} · {t(value(a, "sport"))} ·{" "}
                    {value(
                      records(data, "venues").find(
                        (v) => v.id === a.venue_id,
                      ) || {},
                      "name",
                    )}
                  </p>
                ))}
                {owner && (
                  <ManagementForm
                    title="Assign branch and activity"
                    action="commercial.coach.assign"
                    refresh={refresh}
                    build={(f) => ({
                      coach_id: selected,
                      branch_id: chosenBranch,
                      sport: string(f, "sport"),
                      venue_id: string(f, "venue") || undefined,
                      level_id: string(f, "level") || undefined,
                    })}
                  >
                    <label>
                      {t("Branch")}
                      <select
                        value={chosenBranch}
                        required
                        onChange={(e) => setChosenBranch(e.target.value)}
                      >
                        <option value="">{t("Choose")}</option>
                        {branches.map((b) => (
                          <option key={value(b, "id")} value={value(b, "id")}>
                            {value(b, "name")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Field label="Sport" name="sport" required>
                      <option value="">{t("Choose")}</option>
                      {records(data, "branch_sports")
                        .filter((s) => s.branch_id === chosenBranch)
                        .map((s) => (
                          <option
                            key={value(s, "sport")}
                            value={value(s, "sport")}
                          >
                            {t(value(s, "sport"))}
                          </option>
                        ))}
                    </Field>
                    <Field label="Venue (optional)" name="venue">
                      <option value="">{t("Any venue")}</option>
                      {records(data, "venues")
                        .filter((v) => v.branch_id === chosenBranch)
                        .map((v) => (
                          <option key={value(v, "id")} value={value(v, "id")}>
                            {value(v, "name")}
                          </option>
                        ))}
                    </Field>
                    <Field label="Level (optional)" name="level">
                      <option value="">{t("All levels")}</option>
                      {records(data, "sport_levels").map((l) => (
                        <option key={value(l, "id")} value={value(l, "id")}>
                          {value(l, "sport")} · {value(l, "name")}
                        </option>
                      ))}
                    </Field>
                  </ManagementForm>
                )}
              </>
            )}
            {tab === "Agreements" && (
              <>
                {rates.map((r) => (
                  <div className="management-row" key={value(r, "id")}>
                    <span>
                      {label(r.branch_id)} · {t(value(r, "basis"))} ·{" "}
                      {money(Number(r.amount_minor), locale)}
                      <small>
                        {value(r, "effective_from")} →{" "}
                        {value(r, "effective_to")} ({t("end exclusive")})
                      </small>
                    </span>
                  </div>
                ))}
                <ManagementForm
                  title="Add effective agreement"
                  action="commercial.agreement.create"
                  refresh={refresh}
                  build={(f) => ({
                    coach_id: selected,
                    branch_id: string(f, "branch"),
                    basis: string(f, "basis"),
                    amount_minor: Math.round(Number(f.get("amount")) * 100),
                    sport: string(f, "sport") || undefined,
                    effective_from: string(f, "from"),
                    effective_to: string(f, "to"),
                    cancellation_rule: "unpaid",
                    substitute_rule: string(f, "substitute"),
                  })}
                >
                  <Field label="Branch" name="branch" value={branch} required>
                    <option value="">{t("Choose")}</option>
                    {branches
                      .filter((b) =>
                        records(data, "branch_permissions").some(
                          (a) => a.user_id === selected && a.branch_id === b.id,
                        ),
                      )
                      .map((b) => (
                        <option key={value(b, "id")} value={value(b, "id")}>
                          {value(b, "name")}
                        </option>
                      ))}
                  </Field>
                  <Field label="Payment basis" name="basis">
                    <option value="session">
                      {t("Per completed session")}
                    </option>
                    <option value="hour">{t("Per delivered hour")}</option>
                    <option value="month">{t("Fixed calendar month")}</option>
                  </Field>
                  <Field
                    label="Rate (AED)"
                    name="amount"
                    type="number"
                    required
                    min={0.01}
                  />
                  <Field label="Activity (optional)" name="sport">
                    <option value="">{t("All sports")}</option>
                    {["swimming", "football", "karate", "badminton"].map(
                      (s) => (
                        <option key={s}>{s}</option>
                      ),
                    )}
                  </Field>
                  <Field
                    label="Effective from"
                    name="from"
                    type="date"
                    required
                  />
                  <Field
                    label="Effective until (exclusive)"
                    name="to"
                    type="date"
                    required
                  />
                  <Field label="Substitute coaching" name="substitute">
                    <option value="actual_coach">
                      {t("Pay the actual delivering coach")}
                    </option>
                    <option value="exclude">
                      {t("Exclude substitute delivery")}
                    </option>
                  </Field>
                  <p>
                    {t(
                      "Cancelled sessions are unpaid. Monthly agreements require a full completed calendar month; no automatic proration.",
                    )}
                  </p>
                </ManagementForm>
              </>
            )}
            {tab === "Earnings and payments" && (
              <>
                <CoachEarnings
                  data={data}
                  coachId={selected}
                  refresh={refresh}
                />
                {rates
                  .filter((r) => r.basis === "month")
                  .map((r) => (
                    <ManagementForm
                      key={value(r, "id")}
                      title={
                        label(r.branch_id) +
                        " · " +
                        t("Calculate completed month")
                      }
                      action="commercial.compensation.month"
                      refresh={refresh}
                      build={(f) => ({
                        id: r.id,
                        period_start: string(f, "month") + "-01",
                      })}
                    >
                      <Field label="Month" name="month" type="month" required />
                    </ManagementForm>
                  ))}
              </>
            )}
          </>
        )}
      </PortalDrawer>
    </section>
  );
}
export function CoachEarnings({
  data,
  coachId,
  refresh,
}: {
  data: PortalData;
  coachId?: string;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const [selected, setSelected] = useState<PortalRow | null>(null);
  const branch = value(records(data, "display_branch_id")[0] || {}, "id");
  const [offset, setOffset] = useState(0);
  const key = JSON.stringify([coachId, branch, offset]);
  const [page, setPage] = useState<{
    key: string;
    rows: PortalRow[];
    total: number;
    error?: string;
  }>({ key: "", rows: [], total: 0 });
  useEffect(() => {
    let live = true;
    void api<{ rows: PortalRow[]; total: number }>(
      `management/earnings?offset=${offset}${coachId ? "&coach=" + coachId : ""}${branch ? "&branch=" + branch : ""}`,
    ).then((r) => {
      if (live)
        setPage(
          r.ok
            ? { key, ...r.data }
            : { key, rows: [], total: 0, error: r.message },
        );
    });
    return () => {
      live = false;
    };
  }, [key, coachId, branch, offset, data]);
  const accruals = page.key === key ? page.rows : [];
  const paid = (a: PortalRow) => Number(a.paid_minor || 0);
  return (
    <>
      <div className="management-table-wrap">
        <table className="management-table">
          <thead>
            <tr>
              <th>{t("Coach / work")}</th>
              <th>{t("Earned")}</th>
              <th>{t("Paid")}</th>
              <th>{t("Outstanding")}</th>
              <th>{t("Status")}</th>
              <th>{t("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {accruals.map((a) => (
              <tr key={value(a, "id")}>
                <td>
                  {value(a, "coach_name") ||
                    value(
                      records(data, "coach_directory").find(
                        (p) => p.id === a.coach_id,
                      ) || {},
                      "name",
                    )}
                  <small>{value(a, "branch_name")}</small>
                  <small>
                    {a.period_start
                      ? value(a, "period_start")
                      : a.work_at
                        ? new Date(value(a, "work_at")).toLocaleString(
                            locale === "ar" ? "ar-AE" : "en-GB",
                            {
                              timeZone: "Asia/Dubai",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )
                        : "—"}
                  </small>
                </td>
                <td>{money(Number(a.amount_minor), locale)}</td>
                <td>{money(paid(a), locale)}</td>
                <td>
                  {a.status === "approved"
                    ? money(Number(a.amount_minor) - paid(a), locale)
                    : "—"}
                </td>
                <td>
                  <StatusBadge status={value(a, "status")} />
                </td>
                <td>
                  {a.status === "pending" ||
                  (a.status === "approved" && !paid(a)) ? (
                    <button
                      className="portal-link"
                      onClick={() => setSelected(a)}
                    >
                      {t(
                        a.status === "pending"
                          ? "Review earnings"
                          : "Record payout",
                      )}
                    </button>
                  ) : (
                    t("Recorded")
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!accruals.length && (
          <p>{t("No earnings recorded for this selection.")}</p>
        )}
      </div>
      {page.error && <p role="alert">{t(page.error)}</p>}
      {page.total > 50 && (
        <div className="management-toolbar">
          <span>
            {offset + 1}–{Math.min(offset + 50, page.total)} / {page.total}
          </span>
          <button
            className="portal-btn"
            disabled={!offset}
            onClick={() => setOffset((n) => Math.max(0, n - 50))}
          >
            {t("Previous")}
          </button>
          <button
            className="portal-btn"
            disabled={offset + 50 >= page.total}
            onClick={() => setOffset((n) => n + 50)}
          >
            {t("Next")}
          </button>
        </div>
      )}
      <PortalDrawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={t(
          selected?.status === "pending" ? "Review earnings" : "Record payout",
        )}
        compact
      >
        {selected && (
          <ManagementForm
            key={value(selected, "id")}
            title={money(Number(selected.amount_minor), locale)}
            action={
              selected.status === "pending"
                ? "commercial.compensation.review"
                : "commercial.compensation.settle"
            }
            refresh={() => {
              setSelected(null);
              refresh();
            }}
            build={(f) => ({
              id: selected.id,
              reason: string(f, "reason"),
              ...(selected.status === "pending"
                ? { decision: string(f, "decision") }
                : { reference: string(f, "reference") }),
            })}
          >
            {selected.status === "pending" ? (
              <Field label="Decision" name="decision">
                <option value="approved">{t("Approve")}</option>
                <option value="rejected">{t("Reject")}</option>
              </Field>
            ) : (
              <>
                <p>
                  {t(
                    "Record an offline payment already made. This does not transfer money.",
                  )}
                </p>
                <Field label="Payment reference" name="reference" required />
              </>
            )}
            <Field label="Reason" name="reason" type="textarea" required />
          </ManagementForm>
        )}
      </PortalDrawer>
    </>
  );
}
