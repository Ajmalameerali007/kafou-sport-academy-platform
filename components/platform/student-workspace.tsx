"use client";

import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Search,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useLocale } from "@/components/kafou/locale";
import type { AccountContext } from "@/lib/platform/contracts";
import {
  records,
  value,
  type PortalData,
  type PortalRow,
} from "@/lib/platform/portal-model";
import { Avatar, EmptyState } from "./portal-ui";
import type { Navigate } from "./portal-shell";

type StudentRow = PortalRow & { assigned_sessions?: PortalRow[] };

function coachStudents(data: PortalData): StudentRow[] {
  const students = new Map<string, StudentRow>();
  for (const session of records(data, "coach_sessions")) {
    const roster = Array.isArray(session.students)
      ? (session.students as PortalRow[])
      : [];
    for (const student of roster) {
      const id = value(student, "id");
      if (!id) continue;
      const current = students.get(id);
      students.set(id, {
        ...(current || {}),
        ...student,
        id,
        assigned_sessions: [...(current?.assigned_sessions || []), session],
      });
    }
  }
  return [...students.values()];
}

function linked(rows: PortalRow[], key: string, id: string) {
  return rows.filter((row) => value(row, key) === id);
}

export function StudentWorkspace({
  data,
  workspace,
  account,
  navigate,
}: {
  data: PortalData;
  workspace: string;
  account: AccountContext;
  navigate: Navigate;
}) {
  const { t, locale } = useLocale();
  const coach = workspace === "coach";
  const [query, setQuery] = useState("");
  const students = useMemo<StudentRow[]>(
    () =>
      coach ? coachStudents(data) : (records(data, "children") as StudentRow[]),
    [coach, data],
  );
  const visible = students.filter((student) =>
    value(student, "name").toLowerCase().includes(query.trim().toLowerCase()),
  );
  const [selectedId, setSelectedId] = useState("");
  const selected: StudentRow | undefined =
    visible.find((student) => value(student, "id") === selectedId) ||
    visible[0];
  const id = value(selected || {}, "id");
  const family = records(data, "families").find(
    (row) => value(row, "id") === value(selected || {}, "family_id"),
  );
  const enrollments = coach
    ? []
    : linked(records(data, "enrollments"), "child_id", id);
  const memberships = coach
    ? []
    : linked(records(data, "commercial_memberships"), "child_id", id);
  const assessments = linked(
    records(data, "development_assessments"),
    "child_id",
    id,
  );
  const reports = linked(records(data, "development_reports"), "child_id", id);
  const certificates = linked(records(data, "certificates"), "child_id", id);
  const assigned = selected?.assigned_sessions || [];
  const upcoming = (coach ? assigned : records(data, "family_schedule"))
    .filter((row) => {
      const childId = value(row, "child_id");
      return (
        (!childId || childId === id) &&
        new Date(value(row, "starts_at")) >= new Date()
      );
    })
    .sort((a, b) =>
      value(a, "starts_at").localeCompare(value(b, "starts_at")),
    )[0];
  const published = assessments.filter((row) => row.status === "published");
  const formatDate = (date: string) =>
    date
      ? new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
          timeZone: "Asia/Dubai",
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        }).format(new Date(date))
      : t("Not scheduled");

  return (
    <section className="student-workspace" aria-labelledby="students-title">
      <div className="student-workspace-head">
        <div>
          <h2 id="students-title" className="sr-only">
            {t("Student directory")}
          </h2>
          <p>
            {t(
              coach
                ? "Only athletes on your assigned session rosters appear here."
                : "Find the child once, then follow their schedule, membership and progress.",
            )}
          </p>
        </div>
        <span className="student-access-note">
          <ShieldCheck size={17} />
          {t(coach ? "Assignment-scoped access" : "Permission-scoped records")}
        </span>
      </div>
      <div className="student-workspace-grid">
        <aside
          className="student-directory"
          aria-label={t("Student directory")}
        >
          <label>
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("Search students")}
              aria-label={t("Search students")}
            />
          </label>
          <p className="student-directory-count" role="status">
            {visible.length} {t("authorized students")}
          </p>
          <div className="student-directory-list">
            {visible.map((student) => (
              <button
                key={value(student, "id")}
                aria-current={value(student, "id") === id ? "true" : undefined}
                onClick={() => setSelectedId(value(student, "id"))}
              >
                <Avatar name={value(student, "name")} small />
                <span>
                  <strong>{value(student, "name")}</strong>
                  <small>
                    {value(student, "reported_age")
                      ? `${value(student, "reported_age")} ${t("years")}`
                      : t("Assigned athlete")}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </aside>
        {selected ? (
          <div className="student-journey">
            <header className="student-identity">
              <Avatar name={value(selected, "name")} />
              <div>
                <span className="portal-eyebrow">{t("STUDENT WORKSPACE")}</span>
                <h2>{value(selected, "name")}</h2>
                <p>
                  {coach
                    ? t("Visible through your assigned roster")
                    : [
                        value(family || {}, "name"),
                        value(selected, "reported_age")
                          ? `${value(selected, "reported_age")} ${t("years")}`
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </p>
              </div>
              {!coach && family && (
                <button
                  className="portal-link"
                  onClick={() => navigate("Families", value(family, "id"))}
                >
                  {t("Open family")}
                  <ArrowUpRight size={16} />
                </button>
              )}
            </header>
            <div className="student-journey-grid">
              <article className="student-journey-card student-next">
                <CalendarDays size={20} />
                <span>{t("Next session")}</span>
                <strong>
                  {upcoming
                    ? value(upcoming, "name")
                    : t("No upcoming session")}
                </strong>
                <small>{formatDate(value(upcoming || {}, "starts_at"))}</small>
                <button
                  className="portal-link"
                  onClick={() =>
                    navigate(coach ? "Assigned sessions" : "Schedule")
                  }
                >
                  {t(coach ? "Open roster" : "View schedule")}
                  <ArrowUpRight size={15} />
                </button>
              </article>
              <article className="student-journey-card">
                <Users size={20} />
                <span>{t("Enrollment")}</span>
                <strong>
                  {coach
                    ? `${assigned.length} ${t("assigned sessions")}`
                    : `${enrollments.filter((row) => row.status === "active").length} ${t("active")}`}
                </strong>
                <small>
                  {t("Class and level stay linked to this student.")}
                </small>
              </article>
              {!coach && (
                <article className="student-journey-card">
                  <Wallet size={20} />
                  <span>{t("Membership")}</span>
                  <strong>
                    {memberships.length
                      ? t(value(memberships[0], "status"))
                      : t("No active membership")}
                  </strong>
                  <small>
                    {memberships.length
                      ? `${t(value(memberships[0], "sport"))} · ${t("Valid until")} ${value(memberships[0], "expires_on")}`
                      : t("Membership information appears after enrollment.")}
                  </small>
                  <button
                    className="portal-link"
                    onClick={() => navigate("Memberships")}
                  >
                    {t("View membership")}
                    <ArrowUpRight size={15} />
                  </button>
                </article>
              )}
              <article className="student-journey-card">
                <ClipboardCheck size={20} />
                <span>{t("Attendance")}</span>
                <strong>{t("Session-based record")}</strong>
                <small>
                  {t("Attendance remains separate from the weekly schedule.")}
                </small>
                <button
                  className="portal-link"
                  onClick={() =>
                    navigate(coach ? "Assigned sessions" : "Attendance")
                  }
                >
                  {t("Open attendance")}
                  <ArrowUpRight size={15} />
                </button>
              </article>
              <article className="student-journey-card">
                <GraduationCap size={20} />
                <span>{t("Progress")}</span>
                <strong>
                  {published.length} {t("published assessments")}
                </strong>
                <small>
                  {coach
                    ? t(
                        "Draft and submit progress from the coaching workspace.",
                      )
                    : t("Parents see published progress only.")}
                </small>
                <button
                  className="portal-link"
                  onClick={() => navigate(coach ? "Coaching" : "Progress")}
                >
                  {t("Open progress")}
                  <ArrowUpRight size={15} />
                </button>
              </article>
              {!coach && (
                <article className="student-journey-card">
                  <FileText size={20} />
                  <span>{t("Documents")}</span>
                  <strong>
                    {reports.length + certificates.length} {t("available")}
                  </strong>
                  <small>
                    {reports.length} {t("reports")} · {certificates.length}{" "}
                    {t("certificates")}
                  </small>
                  <button
                    className="portal-link"
                    onClick={() => navigate("Certificates")}
                  >
                    {t("View certificates")}
                    <ArrowUpRight size={15} />
                  </button>
                </article>
              )}
            </div>
            <p className="student-access-footnote">
              <ShieldCheck size={16} />
              {t(
                coach
                  ? "Family contacts and finance are not included in coach access."
                  : locale === "ar"
                    ? `تم تسجيل الدخول باسم ${account.name}. تتبع السجلات صلاحيات دورك وفرعك الحالية.`
                    : `Signed in as ${account.name}. Records follow your existing role and branch permissions.`,
              )}
            </p>
          </div>
        ) : (
          <div className="student-search-empty">
            <EmptyState
              title={
                query.trim() ? "No matching students" : "No authorized students"
              }
              copy={
                query.trim()
                  ? "No students match this search in your permitted records."
                  : coach
                    ? "Students appear after a session is assigned to you."
                    : "No students match this search in your permitted records."
              }
            />
            {query.trim() && (
              <button
                className="portal-btn portal-btn-secondary"
                onClick={() => setQuery("")}
              >
                {t("Clear search")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
