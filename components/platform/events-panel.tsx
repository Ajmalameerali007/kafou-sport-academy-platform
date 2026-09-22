"use client";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import {
  productCommand,
  type ProductData,
  type ProductRow,
} from "@/lib/platform/product";
import {
  campCreateSchema,
  eventAttendanceSchema,
  eventRegistrationSchema,
} from "@/lib/platform/events";
import { ProductNotice, type ProductProps, val } from "./product-shared";

export const eventsArabic: Record<string, string> = {
  "Events and camps": "الفعاليات والمعسكرات",
  "One-off event": "فعالية ليوم واحد",
  "Multi-date camp": "معسكر متعدد المواعيد",
  "Create synthetic camp": "إنشاء معسكر تجريبي",
  "Event format": "نوع الفعالية",
  "Event date": "موعد الفعالية",
  "Number of dates": "عدد المواعيد",
  Scheduled: "مجدول",
  Cancelled: "ملغى",
  "Dated child attendance": "حضور الأطفال لهذا الموعد",
  Unmarked: "لم يُسجّل",
  "Attendance saved": "تم حفظ الحضور",
  "Attendance finalized": "تم اعتماد الحضور",
  "Attendance corrected": "تم تصحيح الحضور",
  "Save attendance": "حفظ الحضور",
  "Finalize attendance": "اعتماد الحضور",
  "Correct attendance": "تصحيح الحضور",
  "Corrected attendance": "الحضور المصحح",
  "Correction reason": "سبب التصحيح",
  Correction: "تصحيح",
  "Cancel this date": "إلغاء هذا الموعد",
  "Event date cancelled": "تم إلغاء موعد الفعالية",
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "غائب بعذر",
  "Save every child’s mark, then finalize after this date ends. Families see finalized marks only.":
    "احفظ حالة حضور كل طفل، ثم اعتمد الحضور بعد انتهاء هذا الموعد. ترى الأسر الحضور المعتمد فقط.",
  "Families see attendance after staff finalize this date.":
    "تظهر بيانات الحضور للأسر بعد اعتماد هذا الموعد من الفريق.",
  "This registration covers every scheduled date above. The accepted timetable and waiver are saved separately for each child.":
    "يشمل هذا التسجيل جميع المواعيد المجدولة أعلاه. يُحفظ الجدول المقبول والإقرار لكل طفل على حدة.",
  "Configure 2–30 non-overlapping dates within 90 days, each within one Dubai day and up to 12 hours. Registration covers all dates and closes at the first start. No payment is collected.":
    "حدّد من موعدَين إلى ٣٠ موعداً غير متداخلة خلال ٩٠ يوماً، على أن يكون كل موعد خلال يوم واحد بتوقيت دبي وبمدة لا تتجاوز ١٢ ساعة. يشمل التسجيل جميع المواعيد ويُغلق عند بداية الموعد الأول. لا تُحصّل دفعات.",
  "I acknowledge this synthetic camp policy and its full timetable, with no payments.":
    "أقر بسياسة المعسكر التجريبية هذه وبجدوله الكامل، دون دفعات.",
  "Check the camp dates, resources and policy acknowledgement.":
    "تحقق من مواعيد المعسكر والمدرب والمكان والإقرار بالسياسة.",
  "Camp coach and venue must be active in the event branch":
    "يجب أن يكون مدرب المعسكر ومكانه متاحين في فرع الفعالية",
  "Camp venue or coach overlaps a class session":
    "يتعارض مكان المعسكر أو مدربه مع حصة أخرى",
  "Camp venue, coach or occurrence schedule overlaps":
    "يوجد تعارض في مكان المعسكر أو مدربه أو مواعيده",
  "Class venue or coach overlaps a camp occurrence":
    "يتعارض مكان الحصة أو مدربها مع موعد معسكر",
  "Class assignment overlaps a camp occurrence":
    "يتعارض تعيين الحصة مع موعد معسكر",
  "Substitute coach overlaps a camp occurrence":
    "يتعارض المدرب البديل مع موعد معسكر",
  "Child must meet the age requirement on every camp date":
    "يجب أن يستوفي الطفل شرط العمر في كل موعد للمعسكر",
  "Child already has an overlapping class or event occurrence":
    "لدى الطفل حصة أو فعالية تتعارض مع هذا الموعد",
  "Only an unstarted occurrence may be cancelled individually":
    "يمكن إلغاء موعد منفرد قبل بدايته فقط",
  "Attendance requires a started unfinalized occurrence":
    "يتطلب تسجيل الحضور موعداً بدأ ولم يُعتمد حضوره بعد",
  "Distinct registered attendance rows required": "اختر تسجيلات حضور مختلفة",
  "Attendance row does not belong to this active occurrence":
    "سجل الحضور لا ينتمي إلى هذا الموعد النشط",
  "Finalize attendance after the occurrence ends":
    "اعتمد الحضور بعد انتهاء الموعد",
  "Mark every active child before finalizing attendance":
    "سجّل حالة كل طفل مسجل قبل اعتماد الحضور",
  "Finalized attendance and correction reason required":
    "يجب أن يكون الحضور معتمداً وأن يُذكر سبب التصحيح",
  "Attendance is unchanged": "حالة الحضور لم تتغير",
  "Event occurrence unavailable": "موعد الفعالية غير متاح",
  "Acknowledge the synthetic camp policy and provide two to thirty occurrences":
    "أقر بسياسة المعسكر التجريبية وحدد من موعدَين إلى ثلاثين موعداً",
  "Camp dates must be future dates within ninety days":
    "يجب أن تكون مواعيد المعسكر مستقبلية ضمن فترة تسعين يوماً",
  "Dubai time": "بتوقيت دبي",
  "Choose each child once": "اختر كل طفل مرة واحدة",
  "Choose one to eight children": "اختر من طفل واحد إلى ثمانية أطفال",
  "Accept the current waiver for every child":
    "وافق على الإقرار الحالي لكل طفل",
  "Event capacity unavailable for the whole family selection":
    "لا تتوفر أماكن كافية لجميع الأطفال المحددين",
  "Child does not meet the event age and assessed level requirements":
    "لا يستوفي الطفل عمر الفعالية أو المستوى المقيّم المطلوب",
  "Child already has an overlapping class session":
    "لدى الطفل حصة تتعارض مع وقت الفعالية",
  "Child already has an overlapping event":
    "لدى الطفل فعالية تتعارض مع هذا الوقت",
  "Session would overlap a registered child event":
    "يتعارض وقت الحصة مع فعالية مسجل فيها الطفل",
  "Event unavailable": "الفعالية غير متاحة",
  "Event configuration unavailable": "إعدادات الفعالية غير متاحة",
  "Event waiver unavailable": "إقرار الفعالية غير متاح",
  "Registration changes closed": "أُغلق تعديل التسجيل",
  "Acknowledge the synthetic event policy":
    "يرجى الإقرار بسياسة الفعالية التجريبية",
  "Cancellation reason required": "سبب الإلغاء مطلوب",

  "One-off events": "فعاليات اليوم الواحد",
  "Synthetic event policy": "سياسة الفعاليات التجريبية",
  "These synthetic events are separate from regular classes. No payment is collected. All selected siblings register together or none do.":
    "هذه فعاليات تجريبية منفصلة عن الحصص المعتادة ولا تُحصّل أي دفعات. يُسجّل جميع الإخوة المحددين معاً أو لا يُسجّل أي منهم.",
  "Create synthetic event": "إنشاء فعالية تجريبية",
  "Event title": "عنوان الفعالية",
  "Starts (Dubai time)": "البداية (بتوقيت دبي)",
  "Ends (Dubai time)": "النهاية (بتوقيت دبي)",
  "Waiver version": "إصدار الموافقة",
  "Choose a waiver": "اختر الموافقة",
  "No events available.": "لا توجد فعاليات متاحة.",
  "Register selected children": "تسجيل الأطفال المحددين",
  "Accept this waiver for this child": "أوافق على هذا الإقرار لهذا الطفل",
  "Registering…": "جارٍ التسجيل…",
  "Choose eligible children from one family. Each child must have the required assessed sport level and age.":
    "اختر الأطفال المؤهلين من أسرة واحدة. يجب أن يستوفي كل طفل مستوى الرياضة المقيّم والعمر المطلوبين.",
  "Registration confirmed": "تم تأكيد التسجيل",
  "Cancel sibling registration": "إلغاء تسجيل الإخوة",
  "Registered children": "الأطفال المسجلون",
  "Cancel event": "إلغاء الفعالية",
  "Cancellation reason": "سبب الإلغاء",
  "Registration cancelled": "تم إلغاء التسجيل",
  "Event cancelled": "تم إلغاء الفعالية",
  "No active registrations.": "لا توجد تسجيلات نشطة.",
  "I acknowledge this is a synthetic one-off event with no payments.":
    "أقر بأن هذه فعالية تجريبية ليوم واحد دون دفعات.",
  "The waiver is unavailable. Registration is closed.":
    "الموافقة غير متاحة. التسجيل مغلق.",
  "Select at least one child and accept their waiver.":
    "اختر طفلاً واحداً على الأقل ووافق على إقراره.",
  "All children in this registration will be cancelled together.":
    "سيتم إلغاء جميع الأطفال في هذا التسجيل معاً.",
  "This event is cancelled.": "تم إلغاء هذه الفعالية.",
};
function useEventText() {
  const { t, locale } = useLocale();
  return (s: string) => (locale === "ar" ? (eventsArabic[s] ?? t(s)) : t(s));
}
function OccurrenceCard({
  occurrence,
  data,
  isStaff,
  isParent,
  busy,
  run,
}: {
  occurrence: ProductRow;
  data: ProductData;
  isStaff: boolean;
  isParent: boolean;
  busy: boolean;
  run: (action: string, data: ProductRow, success: string) => Promise<void>;
}) {
  const t = useEventText();
  const { locale } = useLocale();
  const [observedAt] = useState(() => Date.now());
  const oid = val(occurrence, "id");
  const rows =
    data.event_attendance_register?.filter(
      (r) => val(r, "occurrence_id") === oid,
    ) ?? [];
  const active = rows.filter(
    (r) => val(r, "registration_status") === "registered",
  );
  const finalized = !!occurrence.finalized_at;
  const scheduled = val(occurrence, "status") === "scheduled";
  const started = Date.parse(val(occurrence, "starts_at")) <= observedAt;
  const ended = Date.parse(val(occurrence, "ends_at")) <= observedAt;
  const canRecord =
    !finalized &&
    started &&
    scheduled &&
    active.length > 0 &&
    active.every((r) => r.can_record === true);
  const format = (date: string) =>
    new Date(date).toLocaleString(locale === "ar" ? "ar-AE" : "en-AE", {
      timeZone: "Asia/Dubai",
      dateStyle: "medium",
      timeStyle: "short",
    });
  const venue = data.venues?.find(
    (v) => val(v, "id") === val(occurrence, "venue_id"),
  );
  const coach = data.event_coach_directory?.find(
    (c) => val(c, "coach_id") === val(occurrence, "coach_id"),
  );
  return (
    <details className="ops-editor">
      <summary>
        {t("Event date")} {String(occurrence.position)} ·{" "}
        {format(val(occurrence, "starts_at"))} ·{" "}
        {t(
          finalized
            ? "Attendance finalized"
            : scheduled
              ? "Scheduled"
              : "Cancelled",
        )}
      </summary>
      <p>
        {format(val(occurrence, "starts_at"))} —{" "}
        {format(val(occurrence, "ends_at"))} ({t("Dubai time")})
      </p>
      <p>
        {val(venue, "name")}
        {coach ? ` · ${val(coach, "name")}` : ""}
      </p>
      {val(occurrence, "cancellation_reason") && (
        <p>{val(occurrence, "cancellation_reason")}</p>
      )}
      {canRecord ? (
        <form
          key={active.map((r) => `${r.id}:${r.attendance}`).join("|")}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const parsed = eventAttendanceSchema.safeParse({
              occurrence_id: oid,
              entries: active.map((r) => ({
                registration_id: val(r, "registration_id"),
                attendance: f.get(val(r, "id")),
              })),
            });
            if (parsed.success)
              void run(
                "events.attendance.save",
                parsed.data,
                "Attendance saved",
              );
          }}
        >
          <h4>{t("Dated child attendance")}</h4>
          {active.map((r) => (
            <label key={val(r, "id")}>
              {val(r, "child_name")}
              <select
                name={val(r, "id")}
                defaultValue={val(r, "attendance")}
                required
              >
                <option value="">{t("Choose")}</option>
                {["present", "absent", "late", "excused"].map((status) => (
                  <option key={status} value={status}>
                    {t(status)}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button className="button button-green" disabled={busy}>
            {t("Save attendance")}
          </button>
          {ended && (
            <button
              type="button"
              className="button button-outline"
              disabled={busy || active.some((r) => !r.attendance)}
              onClick={() =>
                void run(
                  "events.attendance.finalize",
                  { occurrence_id: oid },
                  "Attendance finalized",
                )
              }
            >
              {t("Finalize attendance")}
            </button>
          )}
          <p>
            {t(
              "Save every child’s mark, then finalize after this date ends. Families see finalized marks only.",
            )}
          </p>
        </form>
      ) : rows.length > 0 ? (
        <div>
          <h4>{t("Dated child attendance")}</h4>
          {rows.map((r) => (
            <div key={val(r, "id")}>
              <p>
                {val(r, "child_name")} · {t(val(r, "attendance") || "Unmarked")}
              </p>
              {finalized && r.can_correct === true && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void run(
                      "events.attendance.correct",
                      {
                        id: val(r, "id"),
                        attendance: String(f.get("attendance")),
                        reason: String(f.get("reason")),
                      },
                      "Attendance corrected",
                    );
                  }}
                >
                  <label>
                    {t("Corrected attendance")}
                    <select
                      name="attendance"
                      defaultValue={val(r, "attendance")}
                      required
                    >
                      {["present", "absent", "late", "excused"].map(
                        (status) => (
                          <option key={status} value={status}>
                            {t(status)}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label>
                    {t("Correction reason")}
                    <input
                      name="reason"
                      minLength={5}
                      maxLength={500}
                      required
                    />
                  </label>
                  <button className="button button-outline" disabled={busy}>
                    {t("Correct attendance")}
                  </button>
                </form>
              )}
              {data.event_attendance_corrections
                ?.filter((c) => val(c, "attendance_id") === val(r, "id"))
                .map((c) => (
                  <p key={val(c, "id")}>
                    {t("Correction")}: {t(val(c, "previous_attendance"))} →{" "}
                    {t(val(c, "attendance"))} · {val(c, "reason")}
                  </p>
                ))}
            </div>
          ))}
        </div>
      ) : (
        isParent && (
          <p>{t("Families see attendance after staff finalize this date.")}</p>
        )
      )}
      {isStaff && scheduled && !started && !finalized && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "events.occurrence.cancel",
              {
                occurrence_id: oid,
                reason: String(new FormData(e.currentTarget).get("reason")),
              },
              "Event date cancelled",
            );
          }}
        >
          <label>
            {t("Cancellation reason")}
            <input name="reason" minLength={5} maxLength={500} required />
          </label>
          <button className="button button-outline" disabled={busy}>
            {t("Cancel this date")}
          </button>
        </form>
      )}
    </details>
  );
}
function EventCard({
  event,
  data,
  isParent,
  isStaff,
  refresh,
}: {
  event: ProductRow;
  data: ProductData;
  isParent: boolean;
  isStaff: boolean;
  refresh: () => void;
}) {
  const t = useEventText();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [family, setFamily] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const attempt = useRef({ fingerprint: "", key: crypto.randomUUID() });
  const eid = val(event, "id");
  const doc = data.document_versions?.find(
    (x) => val(x, "id") === val(event, "document_id"),
  );
  const batches =
    data.event_registration_batches?.filter(
      (x) => val(x, "event_id") === eid && val(x, "status") === "registered",
    ) ?? [];
  const registrations =
    data.event_registrations?.filter(
      (x) => val(x, "event_id") === eid && val(x, "status") === "registered",
    ) ?? [];
  const children =
    data.children?.filter((x) => val(x, "family_id") === family) ?? [];
  const run = async (action: string, payload: ProductRow, success: string) => {
    if (busy) return;
    const fp = JSON.stringify([action, payload]);
    if (attempt.current.fingerprint !== fp)
      attempt.current = { fingerprint: fp, key: crypto.randomUUID() };
    setBusy(true);
    setNotice("");
    const r = await productCommand(action, payload, attempt.current.key);
    setBusy(false);
    setError(!r.ok);
    setNotice(r.ok ? success : r.message);
    if (r.ok) {
      attempt.current = { fingerprint: "", key: crypto.randomUUID() };
      setChosen([]);
      refresh();
    }
  };
  const [observedAt] = useState(() => Date.now());
  const open =
    val(event, "status") === "open" &&
    new Date(val(event, "starts_at")).getTime() > observedAt;
  return (
    <article className="ops-editor">
      <h3>{val(event, "title")}</h3>
      <p>
        {t(
          val(event, "event_kind") === "camp"
            ? "Multi-date camp"
            : "One-off event",
        )}
      </p>
      {data.event_occurrences
        ?.filter((o) => val(o, "event_id") === eid)
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((o) => (
          <OccurrenceCard
            key={val(o, "id")}
            occurrence={o}
            data={data}
            isStaff={isStaff}
            isParent={isParent}
            busy={busy}
            run={run}
          />
        ))}
      <p>
        {t(val(event, "sport"))} ·{" "}
        {val(
          data.sport_levels?.find(
            (x) => val(x, "id") === val(event, "level_id"),
          ),
          "name",
        )}{" "}
        ·{" "}
        {val(
          data.age_groups?.find(
            (x) => val(x, "id") === val(event, "age_group_id"),
          ),
          "name",
        )}{" "}
        ·{" "}
        {val(
          data.branches?.find((x) => val(x, "id") === val(event, "branch_id")),
          "name",
        )}
      </p>
      {val(event, "status") === "cancelled" && (
        <ProductNotice>{t("This event is cancelled.")}</ProductNotice>
      )}
      {isParent && open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              event_id: eid,
              family_id: family,
              children: chosen.map((child_id) => ({
                child_id,
                document_id: val(doc, "id"),
                accepted: true as const,
              })),
            };
            if (!eventRegistrationSchema.safeParse(payload).success) {
              setError(true);
              setNotice("Select at least one child and accept their waiver.");
              return;
            }
            void run("events.register", payload, "Registration confirmed");
          }}
        >
          <p>
            {t(
              "Choose eligible children from one family. Each child must have the required assessed sport level and age.",
            )}
          </p>
          {val(event, "event_kind") === "camp" && (
            <p>
              {t(
                "This registration covers every scheduled date above. The accepted timetable and waiver are saved separately for each child.",
              )}
            </p>
          )}
          <label>
            {t("Family")}
            <select
              required
              value={family}
              onChange={(e) => {
                setFamily(e.target.value);
                setChosen([]);
              }}
            >
              <option value="">{t("Choose")}</option>
              {data.families?.map((x) => (
                <option key={val(x, "id")} value={val(x, "id")}>
                  {val(x, "name")}
                </option>
              ))}
            </select>
          </label>
          {doc ? (
            <details>
              <summary>
                {t("Waiver version")}: {val(doc, "version")} —{" "}
                {val(doc, "title")}
              </summary>
              <p style={{ whiteSpace: "pre-wrap" }}>{val(doc, "body")}</p>
            </details>
          ) : (
            <ProductNotice error>
              {t("The waiver is unavailable. Registration is closed.")}
            </ProductNotice>
          )}
          <fieldset disabled={busy || !doc}>
            <legend>{t("Children")}</legend>
            {children.map((c) => (
              <label key={val(c, "id")} className="ops-check">
                <input
                  type="checkbox"
                  checked={chosen.includes(val(c, "id"))}
                  onChange={(e) =>
                    setChosen((v) =>
                      e.target.checked
                        ? [...v, val(c, "id")]
                        : v.filter((x) => x !== val(c, "id")),
                    )
                  }
                />
                {val(c, "name")} — {t("Accept this waiver for this child")}
              </label>
            ))}
          </fieldset>
          <button
            className="button button-green"
            disabled={busy || !doc || !chosen.length}
          >
            {t(busy ? "Registering…" : "Register selected children")}
          </button>
        </form>
      )}
      {(isParent || isStaff) && (
        <div>
          <h4>{t("Registered children")}</h4>
          {!batches.length && <p>{t("No active registrations.")}</p>}
          {batches.map((batch) => (
            <div key={val(batch, "id")}>
              <p>
                {registrations
                  .filter((r) => val(r, "batch_id") === val(batch, "id"))
                  .map(
                    (r) =>
                      val(
                        data.children?.find(
                          (c) => val(c, "id") === val(r, "child_id"),
                        ),
                        "name",
                      ) || t("Child"),
                  )
                  .join(", ")}
              </p>
              {isParent && open && (
                <>
                  <p>
                    {t(
                      "All children in this registration will be cancelled together.",
                    )}
                  </p>
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        "events.cancel_registration",
                        { batch_id: val(batch, "id") },
                        "Registration cancelled",
                      )
                    }
                  >
                    {t("Cancel sibling registration")}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
      {isStaff && val(event, "status") === "open" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              "events.cancel",
              {
                event_id: eid,
                reason: String(new FormData(e.currentTarget).get("reason")),
              },
              "Event cancelled",
            );
          }}
        >
          <label>
            {t("Cancellation reason")}
            <input name="reason" minLength={5} maxLength={500} required />
          </label>
          <button className="button button-outline" disabled={busy}>
            {t("Cancel event")}
          </button>
        </form>
      )}
      {notice && <ProductNotice error={error}>{t(notice)}</ProductNotice>}
    </article>
  );
}
export function EventsPanel({ account, data, refresh }: ProductProps) {
  const t = useEventText();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const attempt = useRef({ fingerprint: "", key: crypto.randomUUID() });
  const [camp, setCamp] = useState(false);
  const [slotCount, setSlotCount] = useState(2);
  const [branch, setBranch] = useState("");
  const isParent = account.roles.includes("parent");
  const isStaff = account.roles.some((r) =>
    ["super_admin", "admin", "branch"].includes(r),
  );
  const canManage = (branch: string) =>
    account.roles.includes("super_admin") ||
    (account.roles.some((r) => ["admin", "branch"].includes(r)) &&
      (account.roles.includes("admin") || account.branchIds.includes(branch)) &&
      data.product_permissions?.some(
        (p) =>
          val(p, "user_id") === account.userId &&
          val(p, "permission") === "events.manage" &&
          (!val(p, "branch_id") || val(p, "branch_id") === branch),
      ));
  const branches =
    data.branches?.filter(
      (b) =>
        b.active === true && b.provisional === false && canManage(val(b, "id")),
    ) ?? [];
  return (
    <section className="product-panel">
      <h2>{t("Events and camps")}</h2>
      <ProductNotice>
        {t(
          "These synthetic events are separate from regular classes. No payment is collected. All selected siblings register together or none do.",
        )}
      </ProductNotice>
      {isStaff && branches.length > 0 && (
        <form
          className="ops-editor"
          onSubmit={async (e) => {
            e.preventDefault();
            if (busy) return;
            const form = e.currentTarget;
            const f = new FormData(form);
            const payload: ProductRow = Object.fromEntries(
              [...f.entries()].filter(
                ([key]) => !key.startsWith("occurrence_"),
              ),
            );
            payload.capacity = Number(f.get("capacity"));
            payload.policy_acknowledged = f.get("policy_acknowledged") === "on";
            if (camp) {
              payload.occurrences = Array.from(
                { length: slotCount },
                (_, i) => ({
                  venue_id: String(f.get(`occurrence_${i}_venue`)),
                  coach_id: String(f.get(`occurrence_${i}_coach`)),
                  starts_at:
                    String(f.get(`occurrence_${i}_start`)) + ":00+04:00",
                  ends_at: String(f.get(`occurrence_${i}_end`)) + ":00+04:00",
                }),
              );
              if (!campCreateSchema.safeParse(payload).success) {
                setError(true);
                setNotice(
                  "Check the camp dates, resources and policy acknowledgement.",
                );
                return;
              }
            } else {
              payload.starts_at = String(f.get("starts_at")) + ":00+04:00";
              payload.ends_at = String(f.get("ends_at")) + ":00+04:00";
            }
            const fp = JSON.stringify(payload);
            if (attempt.current.fingerprint !== fp)
              attempt.current = { fingerprint: fp, key: crypto.randomUUID() };
            setBusy(true);
            const r = await productCommand(
              camp ? "events.camp.create" : "events.create",
              payload,
              attempt.current.key,
            );
            setBusy(false);
            setError(!r.ok);
            setNotice(r.ok ? "Saved" : r.message);
            if (r.ok) {
              attempt.current = { fingerprint: "", key: crypto.randomUUID() };
              form.reset();
              setBranch("");
              refresh();
            }
          }}
        >
          <h3>
            {t(camp ? "Create synthetic camp" : "Create synthetic event")}
          </h3>
          <label>
            {t("Event format")}
            <select
              value={camp ? "camp" : "one_off"}
              onChange={(e) => setCamp(e.target.value === "camp")}
            >
              <option value="one_off">{t("One-off event")}</option>
              <option value="camp">{t("Multi-date camp")}</option>
            </select>
          </label>
          <div className="ops-form-grid">
            <label>
              {t("Event title")}
              <input name="title" minLength={2} maxLength={120} required />
            </label>
            <label>
              {t("Branch")}
              <select
                name="branch_id"
                required
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              >
                <option value="">{t("Choose")}</option>
                {branches.map((b) => (
                  <option key={val(b, "id")} value={val(b, "id")}>
                    {val(b, "name")}
                  </option>
                ))}
              </select>
            </label>
            {!camp && (
              <label>
                {t("Venue")}
                <select name="venue_id" required>
                  <option value="">{t("Choose")}</option>
                  {data.venues
                    ?.filter((v) => val(v, "branch_id") === branch)
                    .map((v) => (
                      <option key={val(v, "id")} value={val(v, "id")}>
                        {val(v, "name")}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <label>
              {t("Sport")}
              <select name="sport" required>
                {["swimming", "football", "karate", "badminton"].map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Level")}
              <select name="level_id" required>
                <option value="">{t("Choose")}</option>
                {data.sport_levels
                  ?.filter((l) => l.active === true)
                  .map((l) => (
                    <option key={val(l, "id")} value={val(l, "id")}>
                      {t(val(l, "sport"))}: {val(l, "name")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("Age group")}
              <select name="age_group_id" required>
                <option value="">{t("Choose")}</option>
                {data.age_groups?.map((g) => (
                  <option key={val(g, "id")} value={val(g, "id")}>
                    {val(g, "name")}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Waiver version")}
              <select name="document_id" required>
                <option value="">{t("Choose a waiver")}</option>
                {data.document_versions
                  ?.filter(
                    (d) => d.purpose === "waiver" && d.synthetic === true,
                  )
                  .map((d) => (
                    <option key={val(d, "id")} value={val(d, "id")}>
                      {val(d, "title")} — {val(d, "version")}
                    </option>
                  ))}
              </select>
            </label>
            {!camp && (
              <>
                <label>
                  {t("Starts (Dubai time)")}
                  <input type="datetime-local" name="starts_at" required />
                </label>
                <label>
                  {t("Ends (Dubai time)")}
                  <input type="datetime-local" name="ends_at" required />
                </label>
              </>
            )}
            <label>
              {t("Capacity")}
              <input type="number" name="capacity" min={1} max={100} required />
            </label>
          </div>
          {camp && (
            <div>
              <p>
                {t(
                  "Configure 2–30 non-overlapping dates within 90 days, each within one Dubai day and up to 12 hours. Registration covers all dates and closes at the first start. No payment is collected.",
                )}
              </p>
              <label>
                {t("Number of dates")}
                <input
                  type="number"
                  min={2}
                  max={30}
                  value={slotCount}
                  onChange={(e) =>
                    setSlotCount(
                      Math.min(30, Math.max(2, Number(e.target.value) || 2)),
                    )
                  }
                />
              </label>
              {Array.from({ length: slotCount }, (_, i) => (
                <fieldset className="ops-form-grid" key={i}>
                  <legend>
                    {t("Event date")} {i + 1}
                  </legend>
                  <label>
                    {t("Venue")}
                    <select name={`occurrence_${i}_venue`} required>
                      <option value="">{t("Choose")}</option>
                      {data.venues
                        ?.filter((v) => val(v, "branch_id") === branch)
                        .map((v) => (
                          <option key={val(v, "id")} value={val(v, "id")}>
                            {val(v, "name")}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("Coach")}
                    <select name={`occurrence_${i}_coach`} required>
                      <option value="">{t("Choose")}</option>
                      {data.event_coach_directory
                        ?.filter((c) => val(c, "branch_id") === branch)
                        .map((c) => (
                          <option key={val(c, "id")} value={val(c, "coach_id")}>
                            {val(c, "name")}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    {t("Starts (Dubai time)")}
                    <input
                      type="datetime-local"
                      name={`occurrence_${i}_start`}
                      required
                    />
                  </label>
                  <label>
                    {t("Ends (Dubai time)")}
                    <input
                      type="datetime-local"
                      name={`occurrence_${i}_end`}
                      required
                    />
                  </label>
                </fieldset>
              ))}
            </div>
          )}
          <label className="ops-check">
            <input type="checkbox" name="policy_acknowledged" required />
            {t(
              camp
                ? "I acknowledge this synthetic camp policy and its full timetable, with no payments."
                : "I acknowledge this is a synthetic one-off event with no payments.",
            )}
          </label>
          <button className="button button-green" disabled={busy}>
            {t(
              busy
                ? "Saving…"
                : camp
                  ? "Create synthetic camp"
                  : "Create synthetic event",
            )}
          </button>
          {notice && <ProductNotice error={error}>{t(notice)}</ProductNotice>}
        </form>
      )}
      {!data.academy_events?.length && (
        <ProductNotice>{t("No events available.")}</ProductNotice>
      )}
      {data.academy_events?.map((event) => (
        <EventCard
          key={val(event, "id")}
          event={event}
          data={data}
          isParent={isParent}
          isStaff={isStaff && !!canManage(val(event, "branch_id"))}
          refresh={refresh}
        />
      ))}
    </section>
  );
}
