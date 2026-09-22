"use client";

import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  GraduationCap,
  MapPin,
  Users,
} from "lucide-react";
import { useLocale } from "@/components/kafou/locale";
import type { AccountContext } from "@/lib/platform/contracts";
import {
  records,
  value,
  type PortalData,
  type PortalRow,
} from "@/lib/platform/portal-model";
import { Avatar, EmptyState, StatusBadge } from "./portal-ui";
import { CoachProfilePanel } from "./coach-profile";
import type { Navigate } from "./portal-shell";

export function CoachToday({
  data,
  account,
  navigate,
  refresh,
}: {
  data: PortalData;
  account: AccountContext;
  navigate: Navigate;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const sessions = records(data, "coach_sessions")
    .filter(
      (session) =>
        new Date(value(session, "ends_at") || value(session, "starts_at")) >=
        new Date(),
    )
    .sort((a, b) => value(a, "starts_at").localeCompare(value(b, "starts_at")));
  const next = sessions[0];
  const roster = Array.isArray(next?.students)
    ? (next.students as PortalRow[])
    : [];
  const format = (date: unknown, dateOnly = false) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-GB", {
      timeZone: "Asia/Dubai",
      weekday: dateOnly ? "short" : undefined,
      day: dateOnly ? "numeric" : undefined,
      month: dateOnly ? "short" : undefined,
      hour: dateOnly ? undefined : "numeric",
      minute: dateOnly ? undefined : "2-digit",
    }).format(new Date(String(date)));

  return (
    <div className="coach-today" aria-label={t("Coach Today")}>
      {next ? (
        <section className="coach-next-session">
          <div className="coach-next-main">
            <span className="portal-eyebrow">{t("NEXT ASSIGNED SESSION")}</span>
            <h2>{value(next, "name")}</h2>
            <div className="coach-session-meta">
              <span>
                <CalendarDays size={17} />
                {format(next.starts_at, true)} · {format(next.starts_at)}–
                {format(next.ends_at)}
              </span>
              {value(next, "venue_name") && (
                <span>
                  <MapPin size={17} />
                  {value(next, "venue_name")}
                </span>
              )}
              <span>
                <Users size={17} />
                {roster.length} {t("students on roster")}
              </span>
            </div>
            <div className="coach-next-actions">
              <button
                className="portal-primary"
                onClick={() => navigate("Assigned sessions", value(next, "id"))}
              >
                <ClipboardCheck size={18} />
                {t("Take attendance")}
              </button>
              <button
                className="portal-btn portal-btn-secondary"
                onClick={() => navigate("Students")}
              >
                <Users size={18} />
                {t("Open students")}
              </button>
              <button
                className="portal-btn portal-btn-secondary"
                onClick={() => navigate("Coaching")}
              >
                <GraduationCap size={18} />
                {t("Assess students")}
              </button>
            </div>
          </div>
          <aside className="coach-roster-preview">
            <div>
              <span>{t("Roster preview")}</span>
              <StatusBadge status={value(next, "status")} />
            </div>
            {roster.slice(0, 5).map((student) => (
              <div className="coach-roster-student" key={value(student, "id")}>
                <Avatar name={value(student, "name")} small />
                <span>
                  <strong>{value(student, "name")}</strong>
                  <small>
                    {t(value(student, "attendance") || "Not marked")}
                  </small>
                </span>
              </div>
            ))}
            {roster.length > 5 && (
              <button
                className="portal-link"
                onClick={() => navigate("Assigned sessions", value(next, "id"))}
              >
                +{roster.length - 5} {t("more students")}
                <ArrowUpRight size={15} />
              </button>
            )}
          </aside>
        </section>
      ) : (
        <EmptyState
          title="Your schedule is clear"
          copy="Assigned sessions will appear here when the academy adds them."
        />
      )}
      <div className="coach-today-grid">
        <section className="portal-panel coach-upcoming-list">
          <div className="portal-panel-head">
            <div>
              <span className="portal-eyebrow">{t("UP NEXT")}</span>
              <h2>{t("Assigned schedule")}</h2>
            </div>
            <button
              className="portal-link"
              onClick={() => navigate("Assigned sessions")}
            >
              {t("View all")}
              <ArrowUpRight size={16} />
            </button>
          </div>
          {sessions.slice(1, 6).map((session) => (
            <button
              className="portal-schedule-row interactive"
              key={value(session, "id")}
              onClick={() =>
                navigate("Assigned sessions", value(session, "id"))
              }
            >
              <span className="portal-time-block">
                {format(session.starts_at)}
                <small>{format(session.starts_at, true)}</small>
              </span>
              <span>
                <strong>{value(session, "name")}</strong>
                <small>
                  {Array.isArray(session.students)
                    ? session.students.length
                    : 0}{" "}
                  {t("students on roster")}
                </small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          ))}
          {sessions.length <= 1 && (
            <p className="ops-muted">{t("No additional assigned sessions.")}</p>
          )}
        </section>
        <section className="portal-panel coach-session-checklist">
          <span className="portal-eyebrow">{t("SESSION CHECKLIST")}</span>
          <h2>{t("Leave every session complete")}</h2>
          {[
            "Confirm the roster before the session",
            "Record attendance after the session",
            "Save assessment notes for the right student",
          ].map((item) => (
            <p key={item}>
              <CheckCircle2 size={19} />
              {t(item)}
            </p>
          ))}
        </section>
      </div>
      <details className="coach-profile-disclosure">
        <summary>
          <span>
            {t("My profile")} · {t("Weekly availability")}
          </span>
          <ChevronDown size={18} />
        </summary>
        <CoachProfilePanel data={data} account={account} refresh={refresh} />
      </details>
    </div>
  );
}
