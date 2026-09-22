"use client";
import { OperationalDirectory, SessionCalendar } from "./operational-directory";
import { useState } from "react";
import { dubaiDay } from "@/lib/platform/portal-model";
import { useLocale } from "@/components/kafou/locale";
import { operationsService } from "@/lib/platform/client";
import {
  PortalDrawer,
  StatusBadge,
  Avatar,
  SportIcon,
  announceSaved,
} from "./portal-ui";
import type { AvailableSession } from "@/lib/platform/operations";
type Row = Record<string, unknown>;
type Data = Record<string, Row[]>;
const txt = (r: Row, k: string) => String(r[k] ?? "");
const sports = ["swimming", "football", "karate", "badminton"];
const sportOptions = sports.map((value) => ({
  value,
  label: value[0].toUpperCase() + value.slice(1),
}));
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  value?: string;
};
export function OperationForm({
  title,
  action,
  fields,
  extra = {},
  saved,
  transform,
  button = "Save",
}: {
  title: string;
  action: string;
  fields: Field[];
  extra?: Row;
  saved: () => void;
  transform?: (r: Row) => Row;
  button?: string;
}) {
  const { t } = useLocale();
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="ops-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setNotice("");
        const form = e.currentTarget;
        const values = {
          ...Object.fromEntries(new FormData(e.currentTarget)),
          ...extra,
        };
        const result = await operationsService.command(
          action,
          transform ? transform(values) : values,
        );
        setBusy(false);
        if (result.ok) {
          setNotice(result.data.token || "Saved.");
          announceSaved(form);
          saved();
        } else setNotice(result.message);
      }}
    >
      <h3>{t(title)}</h3>
      <div className="ops-form-grid">
        {fields.map((f) => (
          <label key={f.key}>
            {t(f.label)}
            {f.options ? (
              <select
                name={f.key}
                defaultValue={f.value || ""}
                required={f.required !== false}
              >
                <option value="">{t("Choose")}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(o.label)}
                  </option>
                ))}
              </select>
            ) : (
              <input
                name={f.key}
                type={f.type || "text"}
                defaultValue={f.value || ""}
                required={f.required !== false}
                maxLength={f.type === "date" ? undefined : 500}
              />
            )}
          </label>
        ))}
      </div>
      <button className="button button-dark" disabled={busy}>
        {t(busy ? "Saving…" : button)}
      </button>
      {notice && <p role="status">{t(notice)}</p>}
    </form>
  );
}
export function TrialBookingPanel({
  enquiryId,
  refresh = () => {},
}: {
  enquiryId: string;
  refresh?: () => void;
}) {
  const { t, locale } = useLocale();
  const [slots, setSlots] = useState<AvailableSession[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const load = async () => {
    setBusy(true);
    const r = await operationsService.availability(enquiryId);
    if (r.ok) {
      setSlots(r.data);
      setNotice("");
    } else setNotice(r.message);
    setLoaded(true);
    setBusy(false);
  };
  return (
    <section className="ops-editor">
      <h3>{t("Find an eligible trial")}</h3>
      <p>
        {t(
          "Availability checks branch, sport, age, level and remaining places. A place is reserved only after confirmation.",
        )}
      </p>
      <button
        type="button"
        className="ops-text-button"
        disabled={busy}
        onClick={load}
      >
        {t("Check available sessions")}
      </button>
      {loaded && !slots.length && !notice && (
        <p>
          {t(
            "No eligible sessions are available. Staff can review the starting level and timetable.",
          )}
        </p>
      )}
      <div className="ops-slot-list">
        {slots.map((s) => (
          <article key={s.id}>
            <div>
              <strong>{s.name}</strong>
              <p>
                {new Date(s.starts_at).toLocaleString(
                  locale === "ar" ? "ar-AE" : "en-GB",
                  {
                    timeZone: "Asia/Dubai",
                    dateStyle: "medium",
                    timeStyle: "short",
                  },
                )}{" "}
                · {t("UAE time")}
              </p>
              <p>
                {s.venue} ·{" "}
                {locale === "ar" && s.level_ar ? s.level_ar : s.level} ·{" "}
                {s.places} {t("places available")}
              </p>
            </div>
            <button
              type="button"
              className="button button-dark"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const r = await operationsService.command("trial.book", {
                  enquiry_id: enquiryId,
                  session_id: s.id,
                });
                setBusy(false);
                if (r.ok) {
                  setNotice(`${t("Trial booked")} · ${r.data.reference}`);
                  setSlots([]);
                  refresh();
                } else {
                  setNotice(r.message);
                }
              }}
            >
              {t("Book free trial")}
            </button>
          </article>
        ))}
      </div>
      {notice && <p role="status">{t(notice)}</p>}
    </section>
  );
}
export function Operations({
  data,
  section,
  workspace,
  refresh,
  focusRecord = "",
}: {
  data: Data;
  section: string;
  workspace: string;
  refresh: () => void;
  focusRecord?: string;
}) {
  const { t, locale } = useLocale();
  const rows = (table: string) => data[table] || [];
  const [selected, setSelected] = useState(
      (data.class_sessions || []).some((s) => s.id === focusRecord)
        ? focusRecord
        : "",
    ),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [detailRecord, setDetailRecord] = useState(focusRecord);
  const [createClass, setCreateClass] = useState(false);
  const [claim, setClaim] = useState("");
  const scheduleView = "all";
  const [classView, setClassView] = useState("catalogue");
  const [scheduleDate, setScheduleDate] = useState("");
  const sessionVisible = (s: Row) =>
    (!scheduleDate || dubaiDay(txt(s, "starts_at")) === scheduleDate) &&
    scheduleView === "all";
  const head = workspace === "admin",
    parent = workspace === "parent",
    coach = workspace === "coach",
    branch = workspace === "branch";
  const classes = rows("academy_classes"),
    sessions = rows("class_sessions"),
    bookings = rows("trial_bookings");
  const find = (table: string, id: unknown) =>
    rows(table).find((r) => r.id === id) || {};
  const options = (table: string) =>
    rows(table).map((r) => ({ value: txt(r, "id"), label: txt(r, "name") }));
  const time = (v: unknown) =>
    new Date(String(v)).toLocaleString(locale === "ar" ? "ar-AE" : "en-GB", {
      timeZone: "Asia/Dubai",
      dateStyle: "medium",
      timeStyle: "short",
    });
  const act = async (action: string, payload: Row) => {
    setBusy(true);
    setNotice("");
    const r = await operationsService.command(action, payload);
    setBusy(false);
    if (r.ok) {
      setNotice("Saved.");
      announceSaved();
      refresh();
    } else setNotice(r.message);
  };
  const session = find("class_sessions", selected);
  const roster = rows("session_roster").filter(
    (r) => r.session_id === selected && !r.cancelled,
  );
  const person = (r: Row) =>
    r.kind === "trial"
      ? txt(
          find(
            "trial_enquiries",
            find("trial_bookings", r.trial_booking_id).enquiry_id,
          ),
          "child_name",
        )
      : txt(
          find("children", find("enrollments", r.enrollment_id).child_id),
          "name",
        );
  if (section === "Overview")
    return (
      <div className="ops-summary">
        <h3>
          {t(parent ? "Your next sporting step" : "Operational overview")}
        </h3>
        {parent ? (
          <>
            <p>
              {t("Upcoming trials and active enrollments appear in Trials.")}
            </p>
          </>
        ) : (
          <>
            <p>
              {
                rows("leads").filter(
                  (l) =>
                    l.follow_up_at &&
                    new Date(String(l.follow_up_at)) <= new Date() &&
                    !["converted", "lost"].includes(txt(l, "stage")),
                ).length
              }{" "}
              {t("follow-ups due in loaded records")}
            </p>
            <p>
              {
                sessions.filter(
                  (s) =>
                    new Date(txt(s, "starts_at")).toLocaleDateString("en-CA", {
                      timeZone: "Asia/Dubai",
                    }) ===
                      new Date().toLocaleDateString("en-CA", {
                        timeZone: "Asia/Dubai",
                      }) && s.status === "scheduled",
                ).length
              }{" "}
              {t("sessions today in loaded records")}
            </p>
          </>
        )}
      </div>
    );
  return (
    <>
      {notice && (
        <p role="status" className="ops-notice">
          {t(notice)}
        </p>
      )}
      {section === "Sports / Levels" && head && (
        <>
          <OperationForm
            title="Add sport level"
            action="level.save"
            fields={[
              { key: "sport", label: "Sport", options: sportOptions },
              { key: "name", label: "Level name" },
              { key: "name_ar", label: "Arabic name", required: false },
              { key: "rank", label: "Level order", type: "number" },
              {
                key: "entry_level",
                label: "Beginner entry level",
                options: [
                  { value: "true", label: "Yes" },
                  { value: "false", label: "No" },
                ],
              },
            ]}
            transform={(r) => ({ ...r, entry_level: r.entry_level === "true" })}
            saved={refresh}
          />
          <OperationForm
            title="Add age group"
            action="age.save"
            fields={[
              { key: "name", label: "Age group name" },
              { key: "min_age", label: "Minimum age", type: "number" },
              { key: "max_age", label: "Maximum age", type: "number" },
            ]}
            saved={refresh}
          />
          <div className="ops-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("Sport")}</th>
                  <th>{t("Level")}</th>
                  <th>{t("Beginner entry level")}</th>
                </tr>
              </thead>
              <tbody>
                {rows("sport_levels").map((l) => (
                  <tr key={txt(l, "id")}>
                    <td>{t(txt(l, "sport"))}</td>
                    <td>
                      {locale === "ar" && l.name_ar
                        ? txt(l, "name_ar")
                        : txt(l, "name")}
                    </td>
                    <td>{t(l.entry_level ? "Yes" : "No")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {section === "Classes / Sessions" && (
        <>
          <div
            className="work-view-switch"
            role="group"
            aria-label={t("Class workspace view")}
          >
            {["catalogue", "calendar"].map((view) => (
              <button
                key={view}
                aria-pressed={classView === view}
                onClick={() => setClassView(view)}
              >
                {t(
                  view === "catalogue" ? "Class catalogue" : "Session calendar",
                )}
              </button>
            ))}
          </div>
          {classView === "catalogue" && (
            <>
              {head && (
                <>
                  <button
                    className="button button-dark"
                    onClick={() => setCreateClass(true)}
                  >
                    {t("Create recurring class")}
                  </button>
                  <PortalDrawer
                    open={createClass}
                    onClose={() => setCreateClass(false)}
                    title="Create recurring class"
                  >
                    <OperationForm
                      title="Class definition"
                      action="class.create"
                      fields={[
                        { key: "name", label: "Class name" },
                        {
                          key: "branch_id",
                          label: "Branch",
                          options: rows("branches")
                            .filter((b) => b.active && !b.provisional)
                            .map((b) => ({
                              value: txt(b, "id"),
                              label: txt(b, "name"),
                            })),
                        },
                        {
                          key: "venue_id",
                          label: "Venue",
                          options: options("venues"),
                        },
                        {
                          key: "coach_id",
                          label: "Coach",
                          options: rows("coach_directory").map((c) => ({
                            value: txt(c, "id"),
                            label: txt(c, "name"),
                          })),
                        },
                        { key: "sport", label: "Sport", options: sportOptions },
                        {
                          key: "level_id",
                          label: "Level",
                          options: options("sport_levels"),
                        },
                        {
                          key: "age_group_id",
                          label: "Age group",
                          options: options("age_groups"),
                        },
                        { key: "capacity", label: "Capacity", type: "number" },
                        {
                          key: "weekdays",
                          label:
                            "Weekdays (0 Sunday to 6 Saturday, separated by commas)",
                        },
                        {
                          key: "local_time",
                          label: "Start time (UAE)",
                          type: "time",
                        },
                        {
                          key: "duration_minutes",
                          label: "Duration in minutes",
                          type: "number",
                        },
                      ]}
                      transform={(r) => ({
                        ...r,
                        weekdays: String(r.weekdays).split(",").map(Number),
                      })}
                      saved={refresh}
                    />
                  </PortalDrawer>
                </>
              )}
              <OperationalDirectory
                title="Class catalogue"
                rows={classes}
                searchText={(c) =>
                  [
                    c.name,
                    c.sport,
                    find("coach_directory", c.coach_id).name,
                    find("venues", c.venue_id).name,
                  ].join(" ")
                }
                columns={[
                  {
                    label: "Class",
                    render: (c) => <strong>{txt(c, "name")}</strong>,
                  },
                  {
                    label: "Sport / Level",
                    render: (c) => (
                      <div className="work-cell-stack">
                        <span>{t(txt(c, "sport"))}</span>
                        <small>
                          {txt(find("sport_levels", c.level_id), "name")}
                        </small>
                      </div>
                    ),
                  },
                  {
                    label: "Coach / Venue",
                    render: (c) => (
                      <div className="work-cell-stack">
                        <span>
                          {txt(find("coach_directory", c.coach_id), "name") ||
                            "—"}
                        </span>
                        <small>{txt(find("venues", c.venue_id), "name")}</small>
                      </div>
                    ),
                  },
                  {
                    label: "Start time (UAE)",
                    render: (c) => txt(c, "local_time"),
                  },
                  { label: "Capacity", render: (c) => txt(c, "capacity") },
                  {
                    label: "Status",
                    render: (c) => (
                      <StatusBadge status={c.active ? "active" : "inactive"} />
                    ),
                  },
                ]}
                onOpen={setDetailRecord}
              />
              {classes.length === 0 && <p>{t("No classes configured yet.")}</p>}
              {classes
                .filter((c) => c.id === detailRecord)
                .map((c) => (
                  <PortalDrawer
                    key={txt(c, "id")}
                    open
                    onClose={() => setDetailRecord("")}
                    title={txt(c, "name")}
                  >
                    <p>
                      {txt(find("sport_levels", c.level_id), "name")} ·{" "}
                      {txt(c, "capacity")} {t("places")} ·{" "}
                      {t(c.active ? "Active" : "Inactive")}
                    </p>
                    {head && (
                      <>
                        <OperationForm
                          title="Generate dated sessions"
                          action="sessions.generate"
                          extra={{ class_id: c.id }}
                          fields={[
                            { key: "from", label: "From", type: "date" },
                            { key: "to", label: "To", type: "date" },
                          ]}
                          saved={refresh}
                        />
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            act("class.status", { id: c.id, active: !c.active })
                          }
                        >
                          {t(
                            c.active ? "Pause new bookings" : "Resume bookings",
                          )}
                        </button>
                      </>
                    )}
                  </PortalDrawer>
                ))}
            </>
          )}
          {classView === "calendar" && (
            <SessionCalendar
              sessions={sessions}
              name={(s) => txt(find("academy_classes", s.class_id), "name")}
              detail={(s) => {
                const c = find("academy_classes", s.class_id);
                return [
                  txt(
                    find("coach_directory", s.coach_id || c.coach_id),
                    "name",
                  ),
                  txt(find("venues", s.venue_id || c.venue_id), "name"),
                ]
                  .filter(Boolean)
                  .join(" · ");
              }}
              onOpen={(id) => {
                setSelected(id);
                setMarks({});
              }}
            />
          )}
        </>
      )}
      {section === "Families" && (head || branch) && (
        <details>
          <summary>{t("Give a verified parent family access")}</summary>
          <OperationForm
            title="Issue family access code"
            action="family.offer"
            fields={[
              {
                key: "family_id",
                label: "Family",
                options: options("families"),
              },
              { key: "user_id", label: "Parent account reference" },
            ]}
            saved={() => {}}
          />
        </details>
      )}
      {section === "Trials" && (
        <>
          {parent && (
            <details className="portal-disclosure">
              <summary>{t("Link an existing family account")}</summary>
              <p>
                {t("Your account reference")}:{" "}
                <span className="ops-code" dir="ltr">
                  {txt(rows("profiles")[0] || {}, "id")}
                </span>
              </p>
              <OperationForm
                title="Accept family access from reception"
                action="family.accept"
                fields={[{ key: "token", label: "Family access code" }]}
                saved={refresh}
              />
            </details>
          )}
          <p>
            {t(
              "Bookings reserve a dated session. Enquiries without a booking remain requests.",
            )}
          </p>
          <OperationalDirectory
            title="Trial admissions"
            rows={rows("trial_enquiries")}
            searchText={(q) => [q.child_name, q.sport, q.reference].join(" ")}
            columns={[
              {
                label: "Student",
                render: (q) => <strong>{txt(q, "child_name")}</strong>,
              },
              { label: "Sport", render: (q) => t(txt(q, "sport")) },
              { label: "Age", render: (q) => txt(q, "reported_age") || "—" },
              {
                label: "Trial session",
                render: (q) => {
                  const b = bookings.find(
                    (b) =>
                      b.enquiry_id === q.id &&
                      !["cancelled", "missed"].includes(txt(b, "status")),
                  );
                  return b
                    ? time(find("class_sessions", b.session_id).starts_at)
                    : t("Awaiting booking");
                },
              },
              {
                label: "Status",
                render: (q) => (
                  <StatusBadge
                    status={
                      txt(
                        bookings.find(
                          (b) =>
                            b.enquiry_id === q.id &&
                            !["cancelled", "missed"].includes(txt(b, "status")),
                        ) || {},
                        "status",
                      ) || "requested"
                    }
                  />
                ),
              },
            ]}
            onOpen={setDetailRecord}
            action="Manage trial"
          />
          {rows("trial_enquiries")
            .filter((q) => q.id === detailRecord)
            .map((q) => {
              const b = bookings.find(
                (b) =>
                  b.enquiry_id === q.id &&
                  !["cancelled", "missed"].includes(txt(b, "status")),
              );
              return (
                <PortalDrawer
                  key={txt(q, "id")}
                  open
                  onClose={() => setDetailRecord("")}
                  title={txt(q, "child_name")}
                >
                  <p>
                    {txt(q, "reference")} · {q.reported_age as number}{" "}
                    {t("years")}
                  </p>
                  {b ? (
                    <>
                      <p>
                        {txt(b, "reference")} ·{" "}
                        {time(find("class_sessions", b.session_id).starts_at)}
                      </p>
                      {b.status === "booked" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => act("trial.cancel", { id: b.id })}
                        >
                          {t("Cancel trial")}
                        </button>
                      )}
                      {b.status === "attended" && (head || branch) && (
                        <>
                          <OperationForm
                            title="Convert to Member"
                            action="trial.convert"
                            extra={{ id: b.id }}
                            fields={[
                              {
                                key: "class_id",
                                label: "Class",
                                options: classes
                                  .filter(
                                    (c) =>
                                      c.sport === q.sport &&
                                      c.level_id === b.level_id,
                                  )
                                  .map((c) => ({
                                    value: txt(c, "id"),
                                    label: txt(c, "name"),
                                  })),
                              },
                              {
                                key: "override_reason",
                                label: "Age override reason (only if required)",
                                required: false,
                              },
                            ]}
                            transform={(r) => {
                              if (!r.override_reason) delete r.override_reason;
                              return r;
                            }}
                            saved={refresh}
                            button="Convert to Member"
                          />
                          <p className="ops-next-step">
                            {t(
                              "Conversion creates the family account, child and enrollment. Issue the package and membership card next.",
                            )}{" "}
                            <a
                              className="portal-link"
                              href={`${workspace === "admin" ? "/admin" : `/${workspace}`}?view=Memberships`}
                            >
                              {t("Open memberships")}
                            </a>
                          </p>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <TrialBookingPanel
                        enquiryId={txt(q, "id")}
                        refresh={refresh}
                      />
                      {(head || branch) && (
                        <>
                          <OperationForm
                            title="Review starting level"
                            action="enquiry.level"
                            extra={{ id: q.id }}
                            fields={[
                              {
                                key: "level_id",
                                label: "Level",
                                options: rows("sport_levels")
                                  .filter((l) => l.sport === q.sport)
                                  .map((l) => ({
                                    value: txt(l, "id"),
                                    label: txt(l, "name"),
                                  })),
                              },
                            ]}
                            saved={refresh}
                          />
                          <details>
                            <summary>
                              {t("Authorized allocation override")}
                            </summary>
                            <OperationForm
                              title="Book with recorded override"
                              action="trial.book"
                              extra={{ enquiry_id: q.id }}
                              fields={[
                                {
                                  key: "session_id",
                                  label: "Session",
                                  options: sessions
                                    .filter(
                                      (s) =>
                                        s.status === "scheduled" &&
                                        new Date(txt(s, "starts_at")) >
                                          new Date() &&
                                        find("academy_classes", s.class_id)
                                          .sport === q.sport,
                                    )
                                    .map((s) => ({
                                      value: txt(s, "id"),
                                      label: `${txt(find("academy_classes", s.class_id), "name")} · ${time(s.starts_at)}`,
                                    })),
                                },
                                {
                                  key: "override_reason",
                                  label: "Override reason",
                                },
                              ]}
                              saved={refresh}
                            />
                          </details>
                        </>
                      )}
                    </>
                  )}
                  {(head || branch) && !q.child_id && (
                    <details>
                      <summary>{t("Link parent-authorized child")}</summary>
                      <OperationForm
                        title="Link existing family"
                        action="family.link"
                        extra={{ enquiry_id: q.id }}
                        fields={[
                          { key: "token", label: "Parent sharing code" },
                          { key: "child_id", label: "Child reference" },
                        ]}
                        saved={refresh}
                      />
                    </details>
                  )}
                </PortalDrawer>
              );
            })}
          {rows("trial_enquiries").length === 0 && <p>{t("No trials yet.")}</p>}
          <OperationalDirectory
            title="Enrollments"
            rows={rows("enrollments")}
            searchText={(n) =>
              [
                find("children", n.child_id).name,
                find("academy_classes", n.class_id).name,
                n.status,
              ].join(" ")
            }
            columns={[
              {
                label: "Student",
                render: (n) => txt(find("children", n.child_id), "name"),
              },
              {
                label: "Class",
                render: (n) => txt(find("academy_classes", n.class_id), "name"),
              },
              {
                label: "Status",
                render: (n) => <StatusBadge status={txt(n, "status")} />,
              },
            ]}
          />
          {parent &&
            rows("families").map((f) => (
              <details className="portal-disclosure" key={txt(f, "id")}>
                <summary>{t("Share family with reception")}</summary>
                <p>
                  {t(
                    "Generate a single-use code for reception to link your child to an existing enquiry. Expires after 24 hours.",
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await operationsService.command("family.claim", {
                      family_id: f.id,
                    });
                    setBusy(false);
                    if (r.ok) setClaim(r.data.token || "");
                    else setNotice(r.message);
                  }}
                >
                  {t("Generate sharing code")}
                </button>
                {claim && (
                  <p className="ops-code" dir="ltr">
                    {claim}
                  </p>
                )}
                {rows("children")
                  .filter((c) => c.family_id === f.id)
                  .map((c) => (
                    <p key={txt(c, "id")}>
                      {txt(c, "name")} ·{" "}
                      <span className="ops-code" dir="ltr">
                        {txt(c, "id")}
                      </span>
                    </p>
                  ))}
              </details>
            ))}
        </>
      )}
      {selected && section === "Classes / Sessions" && (
        <PortalDrawer
          open={!!selected}
          onClose={() => setSelected("")}
          title={t("Session details")}
          description={txt(find("academy_classes", session.class_id), "name")}
        >
          <section className="portal-roster-detail" aria-busy={busy}>
            {notice && (
              <p className="ops-notice" role="status">
                {t(notice)}
              </p>
            )}
            <h3>{t("Attendance roster")}</h3>
            <p>
              {time(session.starts_at)} · {t("UAE time")}
            </p>
            {!roster.length && <p>{t("No students on this roster.")}</p>}
            {!session.finalized_at && session.status === "scheduled" && (
              <button
                type="button"
                data-draft-change="attendance"
                onClick={() =>
                  setMarks(
                    Object.fromEntries(
                      roster.map((r) => [txt(r, "id"), "present"]),
                    ),
                  )
                }
              >
                {t("Mark All Present")}
              </button>
            )}
            <div className="ops-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t("Child")}</th>
                    <th>{t("Participation")}</th>
                    <th>{t("Attendance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.map((r) => (
                    <tr key={txt(r, "id")}>
                      <td>
                        <span className="portal-roster-person">
                          <Avatar name={person(r) || t("Student")} small />
                          <strong>{person(r) || t("Student")}</strong>
                        </span>
                      </td>
                      <td>{t(txt(r, "kind"))}</td>
                      <td>
                        {session.finalized_at ? (
                          <StatusBadge status={txt(r, "attendance")} />
                        ) : (
                          <div className="portal-attendance-controls">
                            <div className="portal-attendance-buttons">
                              {["present", "absent", "late", "excused"].map(
                                (a) => (
                                  <button
                                    type="button"
                                    key={a}
                                    aria-label={`${t(a)} ${person(r)}`}
                                    aria-pressed={marks[txt(r, "id")] === a}
                                    onClick={() =>
                                      setMarks({ ...marks, [txt(r, "id")]: a })
                                    }
                                  >
                                    {t(a)}
                                  </button>
                                ),
                              )}
                            </div>
                            <select
                              aria-label={`${t("Attendance")} ${person(r)}`}
                              value={marks[txt(r, "id")] || ""}
                              onChange={(e) =>
                                setMarks({
                                  ...marks,
                                  [txt(r, "id")]: e.target.value,
                                })
                              }
                            >
                              <option value="">{t("Choose")}</option>
                              {["present", "absent", "late", "excused"].map(
                                (a) => (
                                  <option key={a} value={a}>
                                    {t(a)}
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {session.finalized_at ? (
              <p>{t("Attendance finalized. Normal editing is locked.")}</p>
            ) : (
              session.status === "scheduled" && (
                <>
                  <button
                    type="button"
                    className="button button-dark"
                    disabled={
                      busy ||
                      new Date(txt(session, "starts_at")) > new Date() ||
                      roster.some((r) => !marks[txt(r, "id")])
                    }
                    onClick={() =>
                      act("attendance.finalize", {
                        session_id: selected,
                        entries: roster.map((r) => ({
                          id: r.id,
                          attendance: marks[txt(r, "id")],
                        })),
                      })
                    }
                  >
                    {t("Finalize Attendance")}
                  </button>
                  <p>
                    {t(
                      "Finalization becomes available when the session starts.",
                    )}
                  </p>
                  <details>
                    <summary>{t("Cancel session")}</summary>
                    <OperationForm
                      title="Cancel session"
                      action="session.cancel"
                      extra={{ id: selected }}
                      fields={[{ key: "reason", label: "Cancellation reason" }]}
                      saved={refresh}
                    />
                  </details>
                </>
              )
            )}
          </section>
        </PortalDrawer>
      )}
      {coach && section === "Assigned sessions" && (
        <>
          <p>
            {t(
              "Read-only assigned sessions. Attendance editing and assessments are not enabled for coaches.",
            )}
          </p>
          <label className="ops-select">
            {t("Session date")}
            <input
              type="date"
              value={scheduleDate}
              onChange={(e) => setScheduleDate(e.target.value)}
            />
          </label>
          {scheduleDate && (
            <button className="portal-link" onClick={() => setScheduleDate("")}>
              {t("Clear date")}
            </button>
          )}
          {rows("coach_sessions")
            .filter(sessionVisible)
            .map((s) => (
              <details
                className="ops-editor portal-coach-session"
                key={txt(s, "id")}
                open={focusRecord === s.id ? true : undefined}
              >
                <summary>
                  <span className="portal-sport-disc">
                    <SportIcon sport={txt(s, "sport")} />
                  </span>
                  <span>
                    <strong>{txt(s, "name")}</strong>
                    <small>{time(s.starts_at)}</small>
                  </span>
                  <StatusBadge status={txt(s, "status")} />
                </summary>
                <h3>{t("Session roster")}</h3>
                <ul>
                  {((s.students || []) as Row[]).map((k, index) => (
                    <li key={index}>
                      <Avatar name={txt(k, "name")} small />
                      <strong>{txt(k, "name")}</strong>
                      <StatusBadge status={txt(k, "kind")} />
                    </li>
                  ))}
                </ul>
                {!((s.students || []) as Row[]).length && (
                  <p>{t("No students on this roster.")}</p>
                )}
              </details>
            ))}
          {!rows("coach_sessions").filter(sessionVisible).length && (
            <p className="ops-empty">{t("No sessions in this view.")}</p>
          )}
        </>
      )}
    </>
  );
}
export function NewLead({
  data,
  refresh,
  expanded = false,
}: {
  data: Data;
  refresh: () => void;
  expanded?: boolean;
}) {
  const { t } = useLocale();
  return (
    <details
      open={expanded || undefined}
      className={expanded ? "portal-create-form" : undefined}
    >
      <summary>{t("Create lead")}</summary>
      <OperationForm
        title="New lead"
        action="lead.create"
        fields={[
          {
            key: "branch_id",
            label: "Branch",
            options: (data.branches || []).map((b) => ({
              value: txt(b, "id"),
              label: txt(b, "name"),
            })),
          },
          { key: "parent_name", label: "Parent / Guardian name" },
          { key: "mobile", label: "Mobile number" },
          { key: "email", label: "Email", type: "email", required: false },
          { key: "child_name", label: "Child’s name" },
          { key: "age", label: "Child’s age", type: "number" },
          { key: "sport", label: "Sport", options: sportOptions },
          {
            key: "experience",
            label: "Experience",
            options: ["beginner", "some", "training", "unsure"].map(
              (value) => ({ value, label: value }),
            ),
          },
          {
            key: "source",
            label: "Lead source",
            options: [
              "website",
              "social",
              "whatsapp",
              "phone",
              "walk_in",
              "referral",
              "ai",
            ].map((value) => ({ value, label: value })),
          },
        ]}
        saved={refresh}
      />
    </details>
  );
}
