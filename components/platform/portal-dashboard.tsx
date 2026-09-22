"use client";
import { useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Users,
  CalendarDays,
  Activity,
  CheckCircle2,
  Clock3,
  ChevronRight,
  Building2,
  ShieldCheck,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useLocale } from "@/components/kafou/locale";
import type { AccountContext } from "@/lib/platform/contracts";
import {
  records,
  value,
  portalSnapshot,
  scopeOperations,
  familyUpcoming,
  type PortalData,
  type PortalRow,
} from "@/lib/platform/portal-model";
import {
  statusLabel,
  Avatar,
  StatusBadge,
  SportIcon,
  EmptyState,
  PortalDrawer,
} from "./portal-ui";
import { roleTitle, type Navigate } from "./portal-shell";
import { CoachProfilePanel } from "./coach-profile";
const stages = [
  "new",
  "contacted",
  "trial_booked",
  "trial_attended",
  "converted",
  "lost",
];
const stageName: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  trial_booked: "Trial Booked",
  trial_attended: "Trial Attended",
  converted: "Converted",
  lost: "Lost",
};
export function PortalDashboard({
  data,
  workspace,
  account,
  navigate,
  refresh,
}: {
  data: PortalData;
  workspace: string;
  account: AccountContext;
  navigate: Navigate;
  refresh: () => void;
}) {
  const { t, locale } = useLocale(),
    snap = portalSnapshot(data),
    r = (key: string) => records(data, key),
    find = (key: string, id: unknown) => r(key).find((x) => x.id === id) || {};
  const [childId, setChild] = useState("");
  const child = find("children", childId);
  const date = (v: unknown) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
      timeZone: "Asia/Dubai",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(String(v)));
  const time = (v: unknown) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
      timeZone: "Asia/Dubai",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(String(v)));
  if (workspace === "account")
    return (
      <div className="portal-launch">
        <div className="portal-launch-intro">
          <span className="portal-eyebrow">KAFOU / {t("ONE ACADEMY")}</span>
          <h2>{t("Good to have you here.")}</h2>
          <p>
            {t(
              "Choose where you want to work. Your permissions follow you, wherever you go.",
            )}
          </p>
        </div>
        <div className="portal-workspace-grid">
          {[
            ...new Set(
              account.roles.map((x) => (x === "super_admin" ? "admin" : x)),
            ),
          ].map((w) => (
            <a href={`/${w}`} key={w}>
              <span className="portal-launch-icon">
                {w === "parent" ? (
                  <Users />
                ) : w === "coach" ? (
                  <Activity />
                ) : w === "admin" ? (
                  <Building2 />
                ) : (
                  <CalendarDays />
                )}
              </span>
              <small>{t("YOUR ACCESS")}</small>
              <h3>{t(roleTitle(w, account))}</h3>
              <p>
                {t(
                  w === "parent"
                    ? "Your children, their sessions, your next step."
                    : w === "coach"
                      ? "Your assigned sessions and athletes, in one place."
                      : w === "sales"
                        ? "Meaningful conversations. Confident next steps."
                        : "People, sessions and the details that keep the academy moving.",
                )}
              </p>
              <span className="portal-launch-link">
                {t("Open workspace")}
                <ArrowUpRight size={19} />
              </span>
            </a>
          ))}
        </div>
        <p className="portal-security-note">
          <ShieldCheck size={16} />
          {t("Workspace selection never changes your access permissions.")}
        </p>
      </div>
    );
  if (workspace === "parent")
    return (
      <>
        <div className="portal-section-heading">
          <div>
            <span className="portal-eyebrow">{t("GROWING TOGETHER")}</span>
            <h2>{t("Your young athletes")}</h2>
          </div>
          <button className="portal-link" onClick={() => navigate("Family")}>
            {t("Manage your family")}
            <ArrowUpRight size={16} />
          </button>
        </div>
        <div className="portal-athletes">
          {r("children").map((c) => {
            const interests = r("child_sports").filter(
              (s) => s.child_id === c.id,
            );
            const enrollmentIds = new Set(
              r("enrollments")
                .filter((e) => e.child_id === c.id && e.status === "active")
                .map((e) => e.id),
            );
            const sessionIds = new Set(
              r("session_roster")
                .filter(
                  (s) => !s.cancelled && enrollmentIds.has(s.enrollment_id),
                )
                .map((s) => s.session_id),
            );
            const next = snap.upcoming.find((s) => sessionIds.has(s.id));
            return (
              <button
                className="portal-athlete"
                key={value(c, "id")}
                onClick={() => setChild(value(c, "id"))}
              >
                <div className="portal-athlete-top">
                  <Avatar name={value(c, "name")} />
                  <ArrowUpRight size={20} />
                </div>
                <h3>{value(c, "name")}</h3>
                <p>
                  {value(c, "reported_age")
                    ? `${value(c, "reported_age")} ${t("years")} · `
                    : ""}
                  {t("Athlete profile")}
                </p>
                <div className="portal-sport-tags">
                  {interests.map((s) => (
                    <span key={value(s, "id")}>
                      <SportIcon sport={value(s, "sport")} />
                      {t(value(s, "sport"))}
                      <small>
                        {value(
                          find("sport_levels", s.level_id),
                          locale === "ar" ? "name_ar" : "name",
                        ) ||
                          value(s, "level") ||
                          t("Level to be assessed")}
                      </small>
                    </span>
                  ))}
                  {!interests.length && (
                    <p>{t("Their next sport starts here.")}</p>
                  )}
                </div>
                <div className="portal-next-class">
                  <CalendarDays size={17} />
                  <div>
                    <small>{t("Next class")}</small>
                    <strong>
                      {next
                        ? date(next.starts_at)
                        : t("No class scheduled yet")}
                    </strong>
                  </div>
                </div>
              </button>
            );
          })}
          {!r("children").length && (
            <EmptyState
              title="Their journey starts here"
              copy="Add your child to keep their sports and next steps together."
              action="Manage your family"
              onAction={() => navigate("Family")}
            />
          )}
        </div>
        <div className="portal-dashboard-grid">
          <section className="portal-panel">
            <div className="portal-panel-head">
              <h2>{t("Coming up")}</h2>
              <button
                className="portal-link"
                onClick={() => navigate("Trials")}
              >
                {t("Trials")}
                <ArrowUpRight size={16} />
              </button>
            </div>
            {familyUpcoming(data)
              .slice(0, 4)
              .map((s) => (
                <div className="portal-schedule-row" key={value(s, "id")}>
                  <span className="portal-sport-disc">
                    <SportIcon
                      sport={value(
                        find("academy_classes", s.class_id),
                        "sport",
                      )}
                    />
                  </span>
                  <div>
                    <strong>
                      {value(find("academy_classes", s.class_id), "name")}
                    </strong>
                    <small>{date(s.starts_at)}</small>
                  </div>
                  <StatusBadge status={value(s, "status")} />
                </div>
              ))}
            {!familyUpcoming(data).length && (
              <EmptyState
                title="Room for a new beginning"
                copy="A confirmed trial or class will appear here."
                action="View trial status"
                onAction={() => navigate("Trials")}
              />
            )}
          </section>
          <section className="portal-panel portal-family-checklist">
            <h2>{t("Everything in its place")}</h2>
            {[
              [
                "Family",
                "Family details",
                "Keep contact information and consent choices up to date.",
              ],
              [
                "Trials",
                "Trials and enrollment",
                "Follow each enquiry from first interest to a confirmed place.",
              ],
              [
                "Security",
                "Account security",
                "Manage your authenticator and protect your family account.",
              ],
            ].map(([section, title, copy]) => (
              <button key={section} onClick={() => navigate(section)}>
                <CheckCircle2 size={21} />
                <span>
                  <strong>{t(title)}</strong>
                  <small>{t(copy)}</small>
                </span>
                <ChevronRight size={17} />
              </button>
            ))}
          </section>
        </div>
        <PortalDrawer
          open={!!childId}
          onClose={() => setChild("")}
          title={value(child, "name") || t("Child profile")}
          description={t("A sporting journey, one step at a time.")}
        >
          <div className="portal-child-profile">
            <Avatar name={value(child, "name")} />
            <p>
              {value(child, "reported_age")
                ? `${value(child, "reported_age")} ${t("years")} · `
                : ""}
              {t("Sport-specific levels")}
            </p>
          </div>
          {r("child_sports")
            .filter((s) => s.child_id === child.id)
            .map((s) => (
              <div className="portal-profile-sport" key={value(s, "id")}>
                <SportIcon sport={value(s, "sport")} />
                <div>
                  <h3>{t(value(s, "sport"))}</h3>
                  <p>
                    {value(
                      find("sport_levels", s.level_id),
                      locale === "ar" ? "name_ar" : "name",
                    ) ||
                      value(s, "level") ||
                      t("Level to be assessed")}
                  </p>
                </div>
              </div>
            ))}
          <p className="ops-muted">
            {t(
              "Assessments and progress history will be available in the next operational phase.",
            )}
          </p>
          <button
            className="portal-primary"
            onClick={() => {
              setChild("");
              navigate("Family", value(child, "family_id"));
            }}
          >
            {t("Edit child details")}
            <ArrowRight size={17} />
          </button>
        </PortalDrawer>
      </>
    );
  if (workspace === "coach")
    return (
      <>
        <div className="portal-coach-intro">
          <span className="portal-eyebrow">{t("FOCUS ON THE SESSION")}</span>
          <h2>{t("Your athletes. Your next session.")}</h2>
          <p>
            {t(
              "A clear view of your assigned timetable and roster. Student data stays limited to your assignments.",
            )}
          </p>
        </div>
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>{t("Your schedule")}</h2>
            <button
              className="portal-link"
              onClick={() => navigate("Assigned sessions")}
            >
              {t("View all")}
              <ArrowUpRight size={16} />
            </button>
            <span className="portal-badge blue">
              {r("coach_sessions").length} {t("sessions")}
            </span>
          </div>
          {r("coach_sessions")
            .filter(
              (s) =>
                new Date(value(s, "ends_at") || value(s, "starts_at")) >=
                new Date(),
            )
            .slice(0, 6)
            .map((s) => (
              <button
                className="portal-schedule-row interactive"
                key={value(s, "id")}
                onClick={() => navigate("Assigned sessions", value(s, "id"))}
              >
                <span className="portal-time-block">
                  {time(s.starts_at)}
                  <small>
                    {new Date(value(s, "starts_at")).toLocaleDateString(
                      locale === "ar" ? "ar-AE" : "en-GB",
                      {
                        timeZone: "Asia/Dubai",
                        day: "numeric",
                        month: "short",
                      },
                    )}
                  </small>
                </span>
                <span>
                  <strong>{value(s, "name")}</strong>
                  <small>
                    {Array.isArray(s.students) ? s.students.length : 0}{" "}
                    {t("students on roster")}
                  </small>
                </span>
                <StatusBadge status={value(s, "status")} />
                <ChevronRight size={17} />
              </button>
            ))}
          {!r("coach_sessions").length && (
            <EmptyState
              title="Your schedule is clear"
              copy="Assigned sessions will appear here when the academy adds them."
            />
          )}
        </section>
        <p className="ops-muted">
          {t(
            "Your assignments determine student access. Attendance actions follow the academy’s granted permissions.",
          )}
        </p>
        <CoachProfilePanel data={data} account={account} refresh={refresh} />
      </>
    );
  const sales = workspace === "sales";
  const metrics = sales
    ? [
        [
          "New leads",
          r("leads").filter((l) => l.stage === "new").length,
          InboxIcon,
        ],
        ["Follow-ups due", snap.followups.length, Clock3],
        [
          "Trials booked",
          r("trial_bookings").filter((b) => b.status === "booked").length,
          CalendarDays,
        ],
        [
          "Converted",
          r("leads").filter((l) => l.stage === "converted").length,
          CheckCircle2,
        ],
      ]
    : [
        ["Active students", snap.activeStudents, Users],
        ["Sessions today", snap.today.length, CalendarDays],
        ["Trials today", snap.trialsToday, Activity],
        [
          "Attendance today",
          snap.attendancePercent === null ? "—" : `${snap.attendancePercent}%`,
          CheckCircle2,
        ],
      ];
  return (
    <>
      <p className="portal-intro">
        {t(
          sales
            ? "Turn interest into a confident first session."
            : "A clear view of today. The right next step for every family.",
        )}
      </p>
      <div className="portal-metric-grid">
        {metrics.map(([label, n, Icon]) => {
          const MetricIcon = Icon as typeof Users;
          return (
            <div className="portal-metric" key={String(label)}>
              <div>
                <span>{t(String(label))}</span>
                <MetricIcon size={19} />
              </div>
              <strong>{n as React.ReactNode}</strong>
              <small>
                {t(
                  label === "Attendance today"
                    ? "Finalized sessions only"
                    : "In loaded records",
                )}
              </small>
            </div>
          );
        })}
      </div>
      <div className="portal-dashboard-grid">
        <section className="portal-panel">
          <div className="portal-panel-head">
            <div>
              <span className="portal-eyebrow">
                {t(
                  sales ? "YOUR NEXT CONVERSATIONS" : "THE ACADEMY, IN MOTION",
                )}
              </span>
              <h2>{t(sales ? "Follow-ups due" : "Today’s schedule")}</h2>
            </div>
            <button
              className="portal-link"
              onClick={() =>
                navigate(sales ? "Enquiries" : "Classes / Sessions")
              }
            >
              {t("View all")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          {sales ? (
            snap.followups.length ? (
              snap.followups.slice(0, 6).map((l) => (
                <button
                  className="portal-schedule-row interactive"
                  key={value(l, "id")}
                  onClick={() => navigate("Enquiries", value(l, "id"))}
                >
                  <Avatar name={value(l, "parent_name")} small />
                  <span>
                    <strong>{value(l, "parent_name")}</strong>
                    <small>{date(l.follow_up_at)}</small>
                  </span>
                  <StatusBadge status={value(l, "stage")} />
                  <ChevronRight size={16} />
                </button>
              ))
            ) : (
              <EmptyState
                title="Your follow-ups are clear"
                copy="Set the next follow-up inside a lead to keep the conversation moving."
                action="Open enquiry queue"
                onAction={() => navigate("Enquiries")}
              />
            )
          ) : snap.today.length ? (
            snap.today.map((s) => {
              const c = find("academy_classes", s.class_id);
              return (
                <button
                  className="portal-schedule-row interactive"
                  key={value(s, "id")}
                  onClick={() => navigate("Attendance", value(s, "id"))}
                >
                  <span className="portal-time-block">{time(s.starts_at)}</span>
                  <span className="portal-sport-disc">
                    <SportIcon sport={value(c, "sport")} />
                  </span>
                  <span className="portal-schedule-info">
                    <strong>{value(c, "name")}</strong>
                    <small>
                      {value(find("venues", c.venue_id), "name")} ·{" "}
                      {t("Take attendance")} · {snap.occupancy(s.id)}/
                      {value(s, "capacity")} {t("places")}
                    </small>
                  </span>
                  <StatusBadge
                    status={s.finalized_at ? "completed" : value(s, "status")}
                  />
                  <ChevronRight size={16} />
                </button>
              );
            })
          ) : (
            <EmptyState
              title="A little breathing room"
              copy="No sessions are scheduled today in the loaded records."
              action="View schedule"
              onAction={() => navigate("Classes / Sessions")}
            />
          )}
        </section>
        <section className="portal-panel portal-attention">
          <span className="portal-eyebrow">{t("KEEP THINGS MOVING")}</span>
          <h2>{t("Attention required")}</h2>
          {[
            [snap.followups.length, "Follow-ups due", "Enquiries"],
            ...(!sales
              ? [
                  [
                    snap.pendingAttendance.length,
                    "Attendance pending",
                    "Classes / Sessions",
                  ],
                  [
                    snap.conversionReady.length,
                    "Ready for conversion",
                    "Trials",
                  ],
                ]
              : []),
          ].map(([n, label, section]) => (
            <button
              key={String(label)}
              onClick={() => navigate(String(section))}
            >
              <span
                className={`portal-attention-count ${Number(n) > 0 ? "has-items" : ""}`}
              >
                {n}
              </span>
              <span>{t(String(label))}</span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          <p>{t("Based on your current branch view and permitted records.")}</p>
          <button
            className="portal-primary"
            onClick={() => navigate("Enquiries", "new")}
          >
            {t("New lead")}
            <ArrowUpRight size={17} />
          </button>
        </section>
      </div>
      {sales ? (
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>{t("Pipeline at a glance")}</h2>
            <button
              className="portal-link"
              onClick={() => navigate("Enquiries")}
            >
              {t("Open pipeline")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="portal-stage-overview">
            {stages.map((s) => (
              <button key={s} onClick={() => navigate("Enquiries")}>
                <span>{t(stageName[s])}</span>
                <strong>
                  {r("leads").filter((l) => l.stage === s).length}
                </strong>
                <div>
                  <i
                    style={{
                      width: `${r("leads").length ? (100 * r("leads").filter((l) => l.stage === s).length) / r("leads").length : 0}%`,
                    }}
                  />
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : workspace === "admin" ? (
        <section className="portal-panel">
          <div className="portal-panel-head">
            <h2>{t("Across the academy")}</h2>
            <span className="portal-subtle">{t("Operational branches")}</span>
          </div>
          <div className="portal-branch-grid">
            {r("branches")
              .filter(
                (b) =>
                  !b.provisional &&
                  b.active &&
                  (!r("display_branch_id").length ||
                    b.id === r("display_branch_id")[0].id),
              )
              .map((b) => {
                const s = portalSnapshot(scopeOperations(data, value(b, "id")));
                return (
                  <div key={value(b, "id")}>
                    <span className="portal-branch-title">
                      <Building2 size={19} />
                      <strong>
                        {value(
                          b,
                          locale === "ar" && b.name_ar ? "name_ar" : "name",
                        )}
                      </strong>
                    </span>
                    <dl>
                      <div>
                        <dt>{t("Active students")}</dt>
                        <dd>{s.activeStudents}</dd>
                      </div>
                      <div>
                        <dt>{t("Sessions today")}</dt>
                        <dd>{s.today.length}</dd>
                      </div>
                      <div>
                        <dt>{t("Trials today")}</dt>
                        <dd>{s.trialsToday}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
          </div>
        </section>
      ) : null}
    </>
  );
}
const InboxIcon = Users;
export function LeadPipeline({
  data,
  onSelect,
  onCreate,
}: {
  data: PortalData;
  onSelect: (id: string) => void;
  onCreate: () => void;
}) {
  const { t, locale } = useLocale();
  const [query, setQuery] = useState(""),
    [stage, setStage] = useState("all"),
    [due, setDue] = useState(false),
    [view, setView] = useState("board");
  const leads = records(data, "leads").filter(
    (l) =>
      `${value(l, "parent_name")} ${value(l, "mobile")} ${value(l, "email")}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (stage === "all" || l.stage === stage) &&
      (!due ||
        (l.follow_up_at &&
          new Date(value(l, "follow_up_at")) <= new Date() &&
          !["converted", "lost"].includes(value(l, "stage")))),
  );
  const card = (l: PortalRow) => {
    const q =
        records(data, "trial_enquiries").find((q) => q.lead_id === l.id) || {},
      b = records(data, "branches").find((b) => b.id === l.branch_id) || {},
      owner =
        records(data, "staff_directory").find((p) => p.id === l.assigned_to) ||
        {};
    return (
      <button
        className="portal-lead-card"
        key={value(l, "id")}
        onClick={() => onSelect(value(l, "id"))}
      >
        <div>
          <Avatar name={value(l, "parent_name")} small />
          <strong>{value(l, "parent_name")}</strong>
          <ArrowUpRight size={16} />
        </div>
        <p>
          {value(q, "child_name") || t("Child details pending")}
          {Boolean(q.reported_age)
            ? ` · ${value(q, "reported_age")} ${t("years")}`
            : ""}
        </p>
        <div className="portal-lead-meta">
          <span>{t(value(q, "sport") || "Sport to be selected")}</span>
          <span>
            {value(b, locale === "ar" && b.name_ar ? "name_ar" : "name") ||
              t("Unassigned")}
          </span>
        </div>
        <div className="portal-lead-bottom">
          <span>{t(statusLabel(value(l, "source")))}</span>
          <small>{value(owner, "name") || t("Unassigned")}</small>
        </div>
        {Boolean(l.follow_up_at) && (
          <div className="portal-lead-due">
            <Clock3 size={13} />
            {new Date(value(l, "follow_up_at")).toLocaleString(
              locale === "ar" ? "ar-AE" : "en-GB",
              {
                timeZone: "Asia/Dubai",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              },
            )}
          </div>
        )}
        {l.duplicate_review === true && (
          <span className="portal-badge amber">
            {t("Review possible duplicate")}
          </span>
        )}
      </button>
    );
  };
  return (
    <>
      <div className="portal-list-toolbar">
        <label className="portal-filter-input">
          <Search size={17} />
          <input
            aria-label={t("Search leads")}
            placeholder={t("Search leads")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <label className="portal-filter-select">
          <SlidersHorizontal size={16} />
          <select
            aria-label={t("Filter stage")}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
          >
            <option value="all">{t("All stages")}</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {t(stageName[s])}
              </option>
            ))}
          </select>
        </label>
        <button
          className="portal-filter-toggle"
          aria-pressed={due}
          onClick={() => setDue(!due)}
        >
          <Clock3 size={16} />
          {t("Follow-ups due")}
        </button>
        <div className="portal-view-toggle">
          <button
            aria-pressed={view === "board"}
            onClick={() => setView("board")}
          >
            {t("Board")}
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            {t("List")}
          </button>
        </div>
        <button className="portal-primary" onClick={onCreate}>
          {t("New lead")}
          <ArrowUpRight size={16} />
        </button>
      </div>
      <p className="portal-result-count">
        {leads.length} {t("leads in this view")} ·{" "}
        {t(
          "Booking, attendance and conversion update the pipeline automatically.",
        )}
      </p>
      {!leads.length ? (
        <EmptyState
          title="No leads in this view"
          copy="Try another filter or start a new conversation."
          action="New lead"
          onAction={onCreate}
        />
      ) : view === "board" ? (
        <div
          className="portal-kanban"
          role="region"
          aria-label={t("Sales pipeline")}
          tabIndex={0}
        >
          {stages
            .filter((s) => stage === "all" || s === stage)
            .map((s) => (
              <section key={s} className="portal-kanban-column">
                <div className="portal-kanban-heading">
                  <StatusBadge status={s} />
                  <span>{leads.filter((l) => l.stage === s).length}</span>
                </div>
                {leads.filter((l) => l.stage === s).map(card)}
                {!leads.some((l) => l.stage === s) && (
                  <p className="portal-lane-empty">{t("No leads here yet")}</p>
                )}
              </section>
            ))}
        </div>
      ) : (
        <div className="portal-lead-list">
          {leads.map((l) => (
            <div key={value(l, "id")}>
              <StatusBadge status={value(l, "stage")} />
              {card(l)}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
