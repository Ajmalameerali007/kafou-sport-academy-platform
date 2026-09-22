"use client";
import { administratorVerified } from "@/lib/platform/contracts";
import { useRef, useState, type ReactNode } from "react";
import { dubaiDay } from "@/lib/platform/portal-model";
import { useLocale } from "@/components/kafou/locale";
import {
  developmentSchema,
  personalBests,
  type DevelopmentCriterion,
  type DevelopmentResult,
} from "@/lib/platform/development";
import { productCommand, type ProductRow } from "@/lib/platform/product";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductProps,
} from "./product-shared";
import { StatusBadge, announceSaved } from "./portal-ui";
import { DevelopmentEmergencyPanel } from "./emergency-panel";
import { DevelopmentTargetsPanel } from "./targets-panel";
const sports = ["swimming", "football", "karate", "badminton"];
const rows = (value: unknown): ProductRow[] =>
  Array.isArray(value) ? value : [];
const criteria = (row: ProductRow | undefined): DevelopmentCriterion[] =>
  Array.isArray(row?.criteria) ? (row.criteria as DevelopmentCriterion[]) : [];
function CommandForm({
  title,
  action,
  build,
  children,
  onSaved,
  label = "Save draft",
}: {
  title: string;
  action: string;
  build: (f: FormData) => unknown;
  children?: ReactNode;
  onSaved: () => void;
  label?: string;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  const key = useRef(crypto.randomUUID()),
    fingerprint = useRef("");
  return (
    <form
      className="ops-editor product-form"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        setError("");
        setSaved(false);
        const parsed = developmentSchema.safeParse({
          action,
          data: build(new FormData(form)),
        });
        if (!parsed.success) {
          setError(t("Check required fields, metric ranges and evidence."));
          return;
        }
        const next = JSON.stringify(parsed.data);
        if (fingerprint.current && fingerprint.current !== next)
          key.current = crypto.randomUUID();
        fingerprint.current = next;
        setBusy(true);
        try {
          const result = await productCommand(
            parsed.data.action,
            parsed.data.data,
            key.current,
          );
          if (result.ok) {
            setSaved(true);
            key.current = crypto.randomUUID();
            announceSaved(form);
            onSaved();
          } else setError(t(result.message));
        } catch {
          setError(t("Could not save. Please try again."));
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{t(title)}</h3>
      {children}
      {error && <ProductNotice error>{error}</ProductNotice>}
      {saved && <ProductNotice>{t("Saved")}</ProductNotice>}
      <button className="button button-green" disabled={busy}>
        {t(busy ? "Saving…" : label)}
      </button>
    </form>
  );
}
function Action({
  action,
  id,
  label,
  refresh,
}: {
  action: string;
  id: string;
  label: string;
  refresh: () => void;
}) {
  return (
    <CommandForm
      title={label}
      action={action}
      build={() => ({ id })}
      onSaved={refresh}
      label={label}
    />
  );
}
function CriteriaEditor({
  levels,
  refresh,
}: {
  levels: ProductRow[];
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const [sport, setSport] = useState("swimming");
  const [metrics, setMetrics] = useState([0]);
  const next = useRef(1);
  return (
    <CommandForm
      title="Create criteria version"
      action="development.criteria.create"
      label="Create version"
      onSaved={refresh}
      build={(f) => ({
        sport,
        level_id: f.get("level_id"),
        title: f.get("title"),
        criteria: metrics.map((key) => ({
          key: f.get(`key_${key}`),
          label: f.get(`label_${key}`),
          label_ar: f.get(`label_ar_${key}`) || "",
          unit: f.get(`unit_${key}`),
          min: Number(f.get(`min_${key}`)),
          max: Number(f.get(`max_${key}`)),
          direction: f.get(`direction_${key}`),
        })),
      })}
    >
      <p>
        {t("Each revision preserves the criteria used by earlier assessments.")}
      </p>
      <div className="ops-form-grid">
        <label>
          {t("Sport")}
          <select value={sport} onChange={(e) => setSport(e.target.value)}>
            {sports.map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Level")}
          <select name="level_id" key={sport} required defaultValue="">
            <option value="">{t("Choose")}</option>
            {levels
              .filter((l) => l.sport === sport && l.active !== false)
              .map((l) => (
                <option key={val(l, "id")} value={val(l, "id")}>
                  {locale === "ar" && l.name_ar
                    ? val(l, "name_ar")
                    : val(l, "name")}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t("Criteria title")}
          <input name="title" required minLength={2} maxLength={120} />
        </label>
      </div>
      {metrics.map((key, index) => (
        <fieldset className="ops-editor" key={key}>
          <legend>
            {t("Metric")} {index + 1}
          </legend>
          <div className="ops-form-grid">
            <label>
              {t("Metric key")}
              <input
                name={`key_${key}`}
                required
                pattern="[a-z][a-z0-9_]{0,39}"
                placeholder="distance"
                dir="ltr"
              />
            </label>
            <label>
              {t("Metric name")}
              <input
                name={`label_${key}`}
                required
                minLength={2}
                maxLength={120}
              />
            </label>
            <label>
              {t("Arabic metric name")}
              <input name={`label_ar_${key}`} maxLength={120} dir="rtl" />
            </label>
            <label>
              {t("Unit")}
              <input
                name={`unit_${key}`}
                required
                maxLength={20}
                placeholder="m"
              />
            </label>
            <label>
              {t("Minimum")}
              <input
                name={`min_${key}`}
                type="number"
                step="any"
                required
                min={-1000000}
                max={1000000}
              />
            </label>
            <label>
              {t("Maximum")}
              <input
                name={`max_${key}`}
                type="number"
                step="any"
                required
                min={-1000000}
                max={1000000}
              />
            </label>
            <label>
              {t("Better result")}
              <select name={`direction_${key}`}>
                <option value="higher">{t("Higher")}</option>
                <option value="lower">{t("Lower")}</option>
              </select>
            </label>
          </div>
          {metrics.length > 1 && (
            <button
              type="button"
              className="portal-link"
              onClick={() => setMetrics((v) => v.filter((x) => x !== key))}
            >
              {t("Remove metric")}
            </button>
          )}
        </fieldset>
      ))}
      <button
        type="button"
        className="portal-link"
        disabled={metrics.length >= 20}
        onClick={() => setMetrics((v) => [...v, next.current++])}
      >
        {t("Add metric")}
      </button>
    </CommandForm>
  );
}
export function DevelopmentSafetyPanel({ data, refresh }: ProductProps) {
  const { t, locale } = useLocale();
  const children = data.development_safety_children ?? [];
  if (!children.length) return null;
  return (
    <section className="portal-card">
      <h3>{t("Training and safety instructions")}</h3>
      <p>
        {t(
          "Share only current practical instructions needed for training. Assigned coaches see these instructions for relevant sessions.",
        )}
      </p>
      {children.map((child) => (
        <details key={val(child, "id")} className="ops-editor">
          <summary>{val(child, "name")}</summary>
          <p style={{ whiteSpace: "pre-wrap" }}>
            {val(child, "instructions") ||
              t("No current instructions recorded.")}
          </p>
          {Boolean(child.updated_at) && (
            <p>
              {t("Updated")}{" "}
              {new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
                dateStyle: "medium",
                timeZone: "Asia/Dubai",
              }).format(new Date(val(child, "updated_at")))}
            </p>
          )}
          {child.can_edit === true && (
            <CommandForm
              key={val(child, "updated_at")}
              title="Edit current instructions"
              label="Save instructions"
              action="development.safety.save"
              onSaved={refresh}
              build={(f) => ({
                child_id: child.id,
                instructions: f.get("instructions"),
              })}
            >
              <label>
                {t("Current training instructions")}
                <textarea
                  name="instructions"
                  maxLength={1000}
                  defaultValue={val(child, "instructions")}
                />
              </label>
              <small>
                {t(
                  "Up to 1,000 characters. Clear this field to remove outdated instructions. Keep medical documents and detailed health history out of this field.",
                )}
              </small>
            </CommandForm>
          )}
        </details>
      ))}
    </section>
  );
}
function AssessmentEditor({
  session,
  standards,
  levels,
  draft,
  note,
  refresh,
}: {
  session: ProductRow;
  standards: ProductRow[];
  levels: ProductRow[];
  draft?: ProductRow;
  note?: ProductRow;
  refresh: () => void;
}) {
  const { t, locale } = useLocale();
  const available = standards
    .filter((c) => c.level_id === session.level_id)
    .sort((a, b) => Number(a.version) - Number(b.version));
  const [criteriaId, setCriteriaId] = useState(
    val(draft, "criteria_id") || val(available.at(-1), "id"),
  );
  const definition = available.find((c) => c.id === criteriaId);
  const definitions = criteria(definition);
  const students = rows(session.students);
  const draftScores = (draft?.scores ?? {}) as Record<string, number>;
  if (!available.length)
    return (
      <ProductNotice>
        {t(
          "No criteria are configured for this session level. Head Office must add a version before assessment.",
        )}
      </ProductNotice>
    );
  return (
    <CommandForm
      title={draft ? "Edit assessment draft" : "Assess athlete"}
      action="development.assessment.save"
      onSaved={refresh}
      build={(f) => ({
        ...(draft ? { id: draft.id } : {}),
        session_id: session.id,
        child_id: f.get("child_id"),
        criteria_id: criteriaId,
        scores: Object.fromEntries(
          definitions
            .filter((d) => f.get(`score_${d.key}`) !== "")
            .map((d) => [d.key, Number(f.get(`score_${d.key}`))]),
        ),
        summary: f.get("summary"),
        next_target: f.get("next_target"),
        internal_note: f.get("internal_note"),
        ...(f.get("recommended_level_id")
          ? { recommended_level_id: f.get("recommended_level_id") }
          : {}),
      })}
    >
      <div className="ops-form-grid">
        <label>
          {t("Athlete")}
          <select
            name="child_id"
            required
            defaultValue={val(draft, "child_id")}
            disabled={Boolean(draft)}
          >
            {!draft && <option value="">{t("Choose")}</option>}
            {students.map((k) => (
              <option key={val(k, "id")} value={val(k, "id")}>
                {val(k, "name")}
              </option>
            ))}
          </select>
          {draft && (
            <input
              type="hidden"
              name="child_id"
              value={val(draft, "child_id")}
            />
          )}
        </label>
        <label>
          {t("Criteria version")}
          <select
            value={criteriaId}
            disabled={Boolean(draft)}
            onChange={(e) => setCriteriaId(e.target.value)}
          >
            {available.map((c) => (
              <option key={val(c, "id")} value={val(c, "id")}>
                {val(c, "title")} · {t("Version")} {val(c, "version")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div key={criteriaId} className="ops-form-grid">
        {definitions.map((d) => (
          <label key={d.key}>
            {locale === "ar" && d.label_ar ? d.label_ar : d.label} ({d.unit})
            <input
              name={`score_${d.key}`}
              type="number"
              min={d.min}
              max={d.max}
              step="any"
              defaultValue={draftScores[d.key] ?? ""}
            />
            <small>
              {d.min}–{d.max} {d.unit}
            </small>
          </label>
        ))}
      </div>
      <label>
        {t("Family-facing progress summary")}
        <textarea
          name="summary"
          required
          minLength={3}
          maxLength={3000}
          defaultValue={val(draft, "summary")}
        />
      </label>
      <label>
        {t("Next training target")}
        <textarea
          name="next_target"
          maxLength={1000}
          defaultValue={val(draft, "next_target")}
        />
        <small>
          {t(
            "A practical next step linked to this assessment. Families see it after academy review and publication.",
          )}
        </small>
      </label>
      <label>
        {t("Internal coach note")}
        <textarea
          name="internal_note"
          maxLength={3000}
          defaultValue={val(note, "internal_note")}
        />
        <small>
          {t(
            "Only assigned coaching staff and authorized reviewers can read this note.",
          )}
        </small>
      </label>
      <label>
        {t("Recommended next level")}
        <select
          name="recommended_level_id"
          defaultValue={val(draft, "recommended_level_id")}
        >
          <option value="">{t("No recommendation")}</option>
          {levels
            .filter(
              (l) =>
                l.sport === session.sport &&
                l.active !== false &&
                Number(l.rank) >
                  Number(
                    levels.find((x) => x.id === session.level_id)?.rank ?? -1,
                  ),
            )
            .map((l) => (
              <option key={val(l, "id")} value={val(l, "id")}>
                {locale === "ar" && l.name_ar
                  ? val(l, "name_ar")
                  : val(l, "name")}
              </option>
            ))}
        </select>
      </label>
    </CommandForm>
  );
}
function ReportEditor({
  sessions,
  assessments,
  standards,
  refresh,
}: {
  sessions: ProductRow[];
  assessments: ProductRow[];
  standards: ProductRow[];
  refresh: () => void;
}) {
  const { t } = useLocale();
  const [sessionId, setSessionId] = useState(val(sessions[0], "id")),
    [childId, setChildId] = useState(""),
    [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const session = sessions.find((s) => s.id === sessionId);
  const students = rows(session?.students);
  const evidence = assessments.filter((a) => {
    const start = sessions.find((s) => s.id === a.session_id)?.starts_at;
    return (
      Boolean(start) &&
      a.child_id === childId &&
      a.status === "published" &&
      standards.find((c) => c.id === a.criteria_id)?.sport === session?.sport &&
      dubaiDay(String(start)).slice(0, 7) === month
    );
  });
  return (
    <>
      <CommandForm
        title="Create monthly report"
        action="development.report.create"
        onSaved={refresh}
        build={(f) => ({
          session_id: sessionId,
          child_id: childId,
          month,
          summary: f.get("summary"),
          evidence_ids: f.getAll("evidence_ids"),
        })}
      >
        <div className="ops-form-grid">
          <label>
            {t("Assigned session")}
            <select
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setChildId("");
              }}
              required
            >
              {sessions.map((s) => (
                <option key={val(s, "id")} value={val(s, "id")}>
                  {val(s, "name")} · {String(s.starts_at).slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Athlete")}
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              required
            >
              <option value="">{t("Choose")}</option>
              {students.map((k) => (
                <option key={val(k, "id")} value={val(k, "id")}>
                  {val(k, "name")}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("Report month")}
            <input
              type="month"
              required
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </label>
        </div>
        <fieldset>
          <legend>{t("Published evidence")}</legend>
          {evidence.length ? (
            evidence.map((a) => (
              <label key={val(a, "id")}>
                <input
                  type="checkbox"
                  name="evidence_ids"
                  value={val(a, "id")}
                />
                {val(a, "summary")}
              </label>
            ))
          ) : (
            <p>
              {t("No published assessments for this athlete, sport and month.")}
            </p>
          )}
        </fieldset>
        <label>
          {t("Family-facing monthly summary")}
          <textarea name="summary" required minLength={3} maxLength={3000} />
        </label>
      </CommandForm>
      {childId && evidence.length > 0 && (
        <>
          <p>
            {t(
              "Generate a factual draft from published assessments, recorded measurements and finalized attendance. Academy review is still required.",
            )}
          </p>
          <ProductForm
            title="Generate evidence report"
            action="engagement.report.generate"
            initial={{ session_id: sessionId, child_id: childId, month }}
            fields={[]}
            onSaved={refresh}
            submitLabel="Generate draft"
          />
        </>
      )}
    </>
  );
}
export function DevelopmentPanel({
  account,
  data,
  refresh,
  section,
  familyContext = false,
}: ProductProps & { familyContext?: boolean }) {
  const { t, locale } = useLocale();
  const [renderTime] = useState(() => Date.now());
  const [childId, setChildId] = useState(""),
    [sport, setSport] = useState("");
  const all = (name: string) => data[name] ?? [];
  const sessions = all("development_sessions"),
    assignedSessions = sessions.filter((s) => s.can_coach === true),
    standards = all("development_criteria"),
    levels = all("sport_levels");
  const head = account.roles.some((r) => r === "admin" || r === "super_admin"),
    coach = account.roles.includes("coach");
  const can = (permission: string, branch?: unknown) =>
    head &&
    ((account.roles.includes("super_admin") &&
      administratorVerified(account)) ||
      all("product_permissions").some(
        (p) =>
          p.permission === permission &&
          (p.branch_id == null || p.branch_id === branch),
      ));
  const childNames = new Map<string, string>();
  all("children").forEach((k) => childNames.set(val(k, "id"), val(k, "name")));
  sessions.forEach((s) =>
    rows(s.students).forEach((k) =>
      childNames.set(val(k, "id"), val(k, "name")),
    ),
  );
  const childName = (id: unknown) => childNames.get(String(id)) || t("Athlete");
  const levelName = (id: unknown) => {
    const l = levels.find((x) => x.id === id);
    return l
      ? locale === "ar" && l.name_ar
        ? val(l, "name_ar")
        : val(l, "name")
      : t("Level");
  };
  // Parent data is already projected by the workspace's persistent child selector.
  const selectedChildId = familyContext ? "" : childId;
  const selected = (r: ProductRow) =>
    !selectedChildId || r.child_id === selectedChildId;
  const assessments = all("development_assessments")
    .filter(selected)
    .filter(
      (a) =>
        !sport ||
        standards.find((c) => c.id === a.criteria_id)?.sport === sport,
    );
  const reports = all("development_reports")
    .filter(selected)
    .filter((r) => !sport || r.sport === sport);
  const results = all("development_results")
    .filter(selected)
    .filter((r) => !sport || r.sport === sport);
  const certificates = (
    data.development_certificate_records ?? all("development_certificates")
  )
    .filter(selected)
    .filter((r) => !sport || r.sport === sport);
  const reversals = all("development_level_reversals");
  const branchForAssessment = (id: unknown) => {
    const a = all("development_assessments").find((x) => x.id === id);
    const session =
      sessions.find((x) => x.id === a?.session_id) ??
      all("class_sessions").find((x) => x.id === a?.session_id);
    return (
      session?.branch_id ??
      all("academy_classes").find((x) => x.id === session?.class_id)?.branch_id
    );
  };
  const history = all("development_level_history")
    .filter(selected)
    .filter((r) => !sport || r.sport === sport);
  const inProgress = ![
    "criteria",
    "coaching",
    "reports",
    "certificates",
  ].includes(section);
  const showAssessments = inProgress || section === "coaching";
  const formatDate = (date: unknown) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      dateStyle: "medium",
      timeZone: "Asia/Dubai",
    }).format(new Date(String(date)));
  const reviewFields = [
    {
      name: "decision",
      label: "Review decision",
      required: true,
      options: [
        { value: "approved", label: "Approve" },
        { value: "rejected", label: "Return for revision" },
      ],
    },
    {
      name: "reason",
      label: "Internal review reason",
      required: true,
      type: "textarea",
    },
  ];
  return (
    <div className="product-workspace">
      <div className="portal-section-heading">
        <div>
          <p className="eyebrow">{t("GROWING WITH PURPOSE")}</p>
          <h2>
            {t(
              section === "criteria"
                ? "Coaching standards"
                : section === "coaching"
                  ? "Coaching and assessments"
                  : "Your sporting journey",
            )}
          </h2>
          <p>
            {t(
              "Measured progress, reviewed by the academy, kept with each athlete.",
            )}
          </p>
        </div>
      </div>
      {section !== "criteria" && (
        <div className="ops-form-grid">
          {!familyContext && (
            <label>
              {t("Athlete")}
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
              >
                <option value="">{t("All athletes in this view")}</option>
                {[...childNames].map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {t("Sport")}
            <select value={sport} onChange={(e) => setSport(e.target.value)}>
              <option value="">{t("All sports")}</option>
              {sports.map((s) => (
                <option key={s} value={s}>
                  {t(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {(inProgress || section === "coaching") && (
        <DevelopmentSafetyPanel
          account={account}
          data={data}
          refresh={refresh}
          section={section}
        />
      )}
      {(section === "coaching" || section === "criteria") && (
        <DevelopmentEmergencyPanel
          account={account}
          data={data}
          refresh={refresh}
          section={section}
        />
      )}
      {(inProgress || section === "coaching") && (
        <DevelopmentTargetsPanel
          account={account}
          data={data}
          refresh={refresh}
          section={section}
          childId={selectedChildId}
          sport={sport}
        />
      )}
      {section === "criteria" && (
        <>
          <section className="portal-card">
            <h3>{t("Criteria versions")}</h3>
            {standards.length ? (
              standards.map((c) => (
                <details key={val(c, "id")}>
                  <summary>
                    {t(val(c, "sport"))} · {levelName(c.level_id)} ·{" "}
                    {val(c, "title")} · {t("Version")} {val(c, "version")}
                  </summary>
                  <ul>
                    {criteria(c).map((m) => (
                      <li key={m.key}>
                        {locale === "ar" && m.label_ar ? m.label_ar : m.label}:{" "}
                        {m.min}–{m.max} {m.unit} ·{" "}
                        {t(
                          m.direction === "lower"
                            ? "Lower is better"
                            : "Higher is better",
                        )}
                      </li>
                    ))}
                  </ul>
                </details>
              ))
            ) : (
              <ProductNotice>
                {t("No coaching criteria configured yet.")}
              </ProductNotice>
            )}
          </section>
          {can("development.configure") && (
            <CriteriaEditor levels={levels} refresh={refresh} />
          )}
        </>
      )}
      {section === "coaching" && coach && (
        <section className="portal-card">
          <h3>{t("Your assigned sessions")}</h3>
          {assignedSessions.filter((s) => !sport || s.sport === sport)
            .length ? (
            assignedSessions
              .filter((s) => !sport || s.sport === sport)
              .map((s) => (
                <details key={val(s, "id")}>
                  <summary>
                    {val(s, "name")} · {formatDate(s.starts_at)} ·{" "}
                    {t(val(s, "sport"))}
                  </summary>
                  <ProductForm
                    title="Session plan"
                    action="development.plan.save"
                    initial={{
                      session_id: s.id,
                      objectives: val(
                        all("development_session_plans").find(
                          (p) => p.session_id === s.id,
                        ),
                        "objectives",
                      ),
                      activities: val(
                        all("development_session_plans").find(
                          (p) => p.session_id === s.id,
                        ),
                        "activities",
                      ),
                      internal_note: val(
                        all("development_session_plans").find(
                          (p) => p.session_id === s.id,
                        ),
                        "internal_note",
                      ),
                    }}
                    fields={[
                      {
                        name: "objectives",
                        label: "Session objectives",
                        required: true,
                        type: "textarea",
                      },
                      {
                        name: "activities",
                        label: "Planned activities",
                        required: true,
                        type: "textarea",
                      },
                      {
                        name: "internal_note",
                        label: "Internal coach note",
                        type: "textarea",
                      },
                    ]}
                    onSaved={refresh}
                  />
                  {new Date(String(s.starts_at)).getTime() <= renderTime ? (
                    <AssessmentEditor
                      session={s}
                      standards={standards}
                      levels={levels}
                      refresh={refresh}
                    />
                  ) : (
                    <ProductNotice>
                      {t("Assessment opens when the session starts.")}
                    </ProductNotice>
                  )}
                </details>
              ))
          ) : (
            <ProductNotice>
              {t("No current assigned sessions are available.")}
            </ProductNotice>
          )}
        </section>
      )}
      {showAssessments && (
        <section className="portal-card">
          <h3>{t("Progress assessments")}</h3>
          {assessments.length ? (
            assessments.map((a) => {
              const c = standards.find((c) => c.id === a.criteria_id);
              const session = sessions.find((s) => s.id === a.session_id);
              const note = all("development_assessment_notes").find(
                (n) => n.assessment_id === a.id,
              );
              const branch = session?.branch_id;
              return (
                <article className="ops-editor" key={val(a, "id")}>
                  <div className="portal-section-heading">
                    <h4>
                      {childName(a.child_id)} · {t(val(c, "sport"))}
                    </h4>
                    <StatusBadge status={val(a, "status")} />
                  </div>
                  <p>{val(a, "summary")}</p>
                  <p>
                    {val(c, "title")} · {t("Version")} {val(c, "version")}
                  </p>
                  <dl className="ops-form-grid">
                    {criteria(c).map((m) => (
                      <div key={m.key}>
                        <dt>
                          {locale === "ar" && m.label_ar ? m.label_ar : m.label}
                        </dt>
                        <dd>
                          {String(
                            (a.scores as Record<string, unknown>)?.[m.key] ??
                              "—",
                          )}{" "}
                          {m.unit}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {Boolean(a.next_target) && (
                    <p>
                      <strong>{t("Next training target")}</strong>:{" "}
                      {val(a, "next_target")}
                    </p>
                  )}
                  {Boolean(a.recommended_level_id) && (
                    <p>
                      {t("Recommended next level")}:{" "}
                      {levelName(a.recommended_level_id)}
                    </p>
                  )}
                  {Boolean(note?.internal_note) && (
                    <details>
                      <summary>{t("Internal coach note")}</summary>
                      <p>{val(note, "internal_note")}</p>
                    </details>
                  )}
                  {all("development_reviews")
                    .filter((r) => r.assessment_id === a.id)
                    .map((r) => (
                      <p key={val(r, "id")}>
                        {t("Review")}: {t(val(r, "decision"))} ·{" "}
                        {val(r, "reason")}
                      </p>
                    ))}
                  {coach &&
                    a.author_id === account.userId &&
                    session?.can_coach === true &&
                    ["draft", "rejected"].includes(val(a, "status")) && (
                      <details>
                        <summary>{t("Edit assessment draft")}</summary>
                        <AssessmentEditor
                          session={session}
                          standards={standards}
                          levels={levels}
                          draft={a}
                          note={note}
                          refresh={refresh}
                        />
                      </details>
                    )}
                  {coach &&
                    a.author_id === account.userId &&
                    session?.can_coach === true &&
                    a.status === "draft" && (
                      <Action
                        action="development.assessment.submit"
                        id={val(a, "id")}
                        label="Submit for review"
                        refresh={refresh}
                      />
                    )}
                  {a.status === "submitted" &&
                    a.author_id !== account.userId &&
                    can("development.review", branch) && (
                      <ProductForm
                        title="Review assessment"
                        action="development.assessment.review"
                        initial={{ id: a.id }}
                        fields={reviewFields}
                        onSaved={refresh}
                      />
                    )}
                  {a.status === "approved" &&
                    a.author_id !== account.userId &&
                    can("development.publish", branch) && (
                      <Action
                        action="development.assessment.publish"
                        id={val(a, "id")}
                        label="Publish to family"
                        refresh={refresh}
                      />
                    )}
                  {a.status === "published" &&
                    Boolean(a.recommended_level_id) &&
                    !history.some((h) => h.assessment_id === a.id) &&
                    can("development.review", branch) && (
                      <ProductForm
                        title="Approve level progression"
                        action="development.level.approve"
                        initial={{ assessment_id: a.id }}
                        fields={[
                          {
                            name: "reason",
                            label: "Family-facing approval reason",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        onSaved={refresh}
                      />
                    )}
                  {a.status === "published" &&
                    !certificates.some((c) => c.assessment_id === a.id) &&
                    can("development.certify", branch) && (
                      <ProductForm
                        title="Issue achievement certificate"
                        action="development.certificate.issue"
                        initial={{ assessment_id: a.id }}
                        fields={[
                          {
                            name: "title",
                            label: "Certificate title",
                            required: true,
                          },
                        ]}
                        onSaved={refresh}
                      />
                    )}
                </article>
              );
            })
          ) : (
            <ProductNotice>
              {t("No progress assessments in this view yet.")}
            </ProductNotice>
          )}
        </section>
      )}
      {inProgress && (
        <>
          <section className="portal-card">
            <h3>{t("Personal bests")}</h3>
            <p>
              {t(
                "Real measurements stay in their original unit and criteria version.",
              )}
            </p>
            {results.length ? (
              <dl className="ops-form-grid">
                {personalBests(results as DevelopmentResult[]).map((r) => (
                  <div key={r.id}>
                    <dt>
                      {childName(r.child_id)} ·{" "}
                      {locale === "ar" && r.label_ar
                        ? val(r, "label_ar")
                        : val(r, "label")}
                    </dt>
                    <dd>
                      <strong>
                        {Number(r.value).toLocaleString(
                          locale === "ar" ? "ar-AE" : "en-AE",
                        )}{" "}
                        {r.unit}
                      </strong>{" "}
                      · {t("Version")}{" "}
                      {val(
                        standards.find((c) => c.id === r.criteria_id),
                        "version",
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <ProductNotice>
                {t("Published measurements will appear here.")}
              </ProductNotice>
            )}
          </section>
          <section className="portal-card">
            <h3>{t("Sport level history")}</h3>
            {history.length ? (
              history.map((h) => {
                const reversal = reversals.find((r) => r.history_id === h.id);
                const current =
                  all("child_sports").find(
                    (c) => c.child_id === h.child_id && c.sport === h.sport,
                  )?.level_id === h.to_level_id;
                return (
                  <article key={val(h, "id")} className="ops-editor">
                    <h4>
                      {childName(h.child_id)} · {t(val(h, "sport"))}:{" "}
                      {levelName(h.from_level_id)} → {levelName(h.to_level_id)}
                    </h4>
                    <p>
                      {formatDate(h.created_at)} · {val(h, "reason")}
                    </p>
                    {reversal ? (
                      <ProductNotice>
                        {t("Progression reversed")} ·{" "}
                        {formatDate(reversal.reversed_at)} ·{" "}
                        {val(reversal, "reason")}
                      </ProductNotice>
                    ) : (
                      current &&
                      can(
                        "development.review",
                        branchForAssessment(h.assessment_id),
                      ) && (
                        <details>
                          <summary>{t("Reverse approved progression")}</summary>
                          <p>
                            {t(
                              "Restores the previous sport level and withdraws related certificates. No class enrollment is created or changed.",
                            )}
                          </p>
                          <ProductForm
                            title="Reverse approved progression"
                            action="development.level.reverse"
                            initial={{ id: h.id }}
                            fields={[
                              {
                                name: "reason",
                                label: "Family-facing correction reason",
                                type: "textarea",
                                required: true,
                              },
                            ]}
                            onSaved={refresh}
                          />
                        </details>
                      )
                    )}
                  </article>
                );
              })
            ) : (
              <ProductNotice>
                {t(
                  "Approved level changes will appear here. Class changes are arranged separately.",
                )}
              </ProductNotice>
            )}
          </section>
        </>
      )}
      {(inProgress || section === "reports" || section === "coaching") && (
        <section className="portal-card">
          <h3>{t("Monthly reports")}</h3>
          {coach && assignedSessions.length > 0 && (
            <details>
              <summary>{t("Create monthly report")}</summary>
              <ReportEditor
                sessions={assignedSessions}
                assessments={all("development_assessments")}
                standards={standards}
                refresh={refresh}
              />
            </details>
          )}
          {reports.length ? (
            reports.map((r) => {
              const session = sessions.find((s) => s.id === r.session_id);
              return (
                <article className="ops-editor" key={val(r, "id")}>
                  <h4>
                    {childName(r.child_id)} · {t(val(r, "sport"))} ·{" "}
                    {String(r.month).slice(0, 7)}
                  </h4>
                  <StatusBadge status={val(r, "status")} />
                  {r.status === "published" && (
                    <a
                      className="button button-outline"
                      href={`/api/product/reports/${encodeURIComponent(val(r, "id"))}?locale=${locale === "ar" ? "ar" : "en"}`}
                      download
                    >
                      {t("Download published report PDF")}
                    </a>
                  )}
                  <p>{val(r, "summary")}</p>
                  <p>
                    {t("Version")} {val(r, "version")} ·{" "}
                    {t("Evidence assessments")}:{" "}
                    {Array.isArray(r.evidence_ids) ? r.evidence_ids.length : 0}
                  </p>
                  <ul>
                    {Array.isArray(r.evidence_ids) &&
                      r.evidence_ids.map((id) => {
                        const a = all("development_assessments").find(
                          (x) => x.id === id,
                        );
                        return (
                          <li key={String(id)}>
                            {a ? val(a, "summary") : t("Published assessment")}
                          </li>
                        );
                      })}
                  </ul>
                  {all("development_reviews")
                    .filter((v) => v.report_id === r.id)
                    .map((v) => (
                      <p key={val(v, "id")}>
                        {t("Review")}: {t(val(v, "decision"))} ·{" "}
                        {val(v, "reason")}
                      </p>
                    ))}
                  {r.status === "rejected" &&
                    r.author_id === account.userId && (
                      <p>
                        {t(
                          "Edit the draft using the review feedback, then submit it again.",
                        )}
                      </p>
                    )}
                  {coach &&
                    r.author_id === account.userId &&
                    ["draft", "rejected"].includes(val(r, "status")) && (
                      <details>
                        <summary>{t("Edit report summary")}</summary>
                        <ProductForm
                          title="Edit report summary"
                          action="engagement.report.edit"
                          initial={{ id: r.id, summary: r.summary }}
                          fields={[
                            {
                              name: "summary",
                              label: "Family-facing monthly summary",
                              type: "textarea",
                              required: true,
                            },
                          ]}
                          onSaved={refresh}
                        />
                      </details>
                    )}
                  {coach &&
                    r.author_id === account.userId &&
                    r.status === "draft" && (
                      <Action
                        action="development.report.submit"
                        id={val(r, "id")}
                        label="Submit report for review"
                        refresh={refresh}
                      />
                    )}
                  {r.status === "submitted" &&
                    r.author_id !== account.userId &&
                    can("development.review", session?.branch_id) && (
                      <ProductForm
                        title="Review monthly report"
                        action="development.report.review"
                        initial={{ id: r.id }}
                        fields={reviewFields}
                        onSaved={refresh}
                      />
                    )}{" "}
                  {r.status === "approved" &&
                    r.author_id !== account.userId &&
                    can("development.publish", session?.branch_id) && (
                      <Action
                        action="development.report.publish"
                        id={val(r, "id")}
                        label="Publish report to family"
                        refresh={refresh}
                      />
                    )}
                </article>
              );
            })
          ) : (
            <ProductNotice>
              {t("No monthly reports in this view yet.")}
            </ProductNotice>
          )}
        </section>
      )}
      {(inProgress || section === "certificates") && (
        <section className="portal-card">
          <h3>{t("Achievement certificates")}</h3>
          {certificates.length ? (
            certificates.map((c) => {
              const authorized = can(
                "development.certify",
                c.branch_id ?? branchForAssessment(c.assessment_id),
              );
              const replaced = certificates.some((x) => x.replaces_id === c.id);
              return (
                <article className="ops-editor" key={val(c, "id")}>
                  <h4>{val(c, "title")}</h4>
                  <p>
                    {val(c, "recipient_name")} · {t(val(c, "sport"))} ·{" "}
                    {val(c, "level_name")}
                  </p>
                  <p>
                    {formatDate(c.issued_at)} · {val(c, "reference")} ·{" "}
                    {t("Version")} {String(c.version ?? 1)}
                  </p>
                  {Boolean(c.reissue_reason) && (
                    <p>
                      {t("Family-facing correction reason")}:{" "}
                      {val(c, "reissue_reason")}
                    </p>
                  )}
                  {c.revoked_at ? (
                    <ProductNotice>
                      {t("Certificate withdrawn")} ·{" "}
                      {val(c, "revocation_reason")}
                    </ProductNotice>
                  ) : (
                    <a
                      className="button button-dark"
                      href={`/api/product/certificates/${encodeURIComponent(val(c, "id"))}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("Download private PDF")}
                    </a>
                  )}
                  {authorized && !c.revoked_at && (
                    <details>
                      <summary>{t("Revoke certificate")}</summary>
                      <ProductForm
                        title="Revoke certificate"
                        action="development.certificate.revoke"
                        initial={{ id: c.id }}
                        fields={[
                          {
                            name: "reason",
                            label: "Family-facing revocation reason",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        onSaved={refresh}
                      />
                    </details>
                  )}
                  {authorized && !replaced && (
                    <details>
                      <summary>{t("Reissue certificate")}</summary>
                      <p>
                        {t(
                          "The replacement gets a new reference. Earlier versions remain in the history and cannot be downloaded.",
                        )}
                      </p>
                      <ProductForm
                        title="Reissue certificate"
                        action="development.certificate.reissue"
                        initial={{ id: c.id, title: c.title }}
                        fields={[
                          {
                            name: "title",
                            label: "Certificate title",
                            required: true,
                          },
                          {
                            name: "reason",
                            label: "Family-facing correction reason",
                            type: "textarea",
                            required: true,
                          },
                        ]}
                        onSaved={refresh}
                      />
                    </details>
                  )}
                </article>
              );
            })
          ) : (
            <ProductNotice>
              {t(
                "Issued certificates will appear here after academy approval.",
              )}
            </ProductNotice>
          )}
        </section>
      )}
    </div>
  );
}
