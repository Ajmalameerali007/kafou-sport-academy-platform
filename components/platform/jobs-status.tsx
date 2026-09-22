"use client";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { jobHealth, readJobs, type JobStatus } from "@/lib/platform/jobs";

/** Observability only: no activation, run or retry controls in the browser. */
export function JobsStatus() {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const text = (en: string, arabic: string) => (ar ? arabic : en);
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(true);
  async function reload() {
    setBusy(true);
    setError(false);
    setStatus(null);
    const result = await readJobs();
    if (result.ok) setStatus(result.data);
    else setError(true);
    setBusy(false);
  }
  useEffect(() => {
    let disposed = false;
    void readJobs().then((result) => {
      if (disposed) return;
      if (result.ok) setStatus(result.data);
      else setError(true);
      setBusy(false);
    });
    return () => {
      disposed = true;
    };
  }, []);
  const health = status ? jobHealth(status) : null;
  const labels = {
    inactive: text(
      "Inactive — no current branch approval",
      "غير نشط — لا توجد موافقة حالية للفرع",
    ),
    clock_required: text(
      "Branch approved; recurring clock not activated",
      "الفرع معتمد؛ لم يُفعّل التشغيل الدوري",
    ),
    attention: text(
      "Active; failures need review",
      "نشط؛ توجد إخفاقات تحتاج إلى مراجعة",
    ),
    ready: text(
      "Active for approved synthetic branches",
      "نشط للفروع التجريبية المعتمدة",
    ),
  };
  const format = (date: string) =>
    new Intl.DateTimeFormat(ar ? "ar-AE" : "en-AE", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dubai",
    }).format(new Date(date));
  return (
    <section
      className="ops-editor"
      aria-labelledby="jobs-status-title"
      aria-busy={busy}
    >
      <h2 id="jobs-status-title">
        {text("Scheduled in-app work", "المهام المجدولة داخل التطبيق")}
      </h2>
      <p>
        {text(
          "Broadcasts, renewal reminders, waitlist expiry, monthly drafts and approved completion certificates. Each workflow needs its current policy. External delivery and automatic charges stay disabled.",
          "الإعلانات وتذكيرات التجديد وانتهاء الانتظار والمسودات الشهرية وشهادات التقدم المعتمد. يتطلب كل مسار سياسة سارية. الإرسال الخارجي والخصم التلقائي معطّلان.",
        )}
      </p>
      <button
        className="button button-outline"
        type="button"
        disabled={busy}
        onClick={() => void reload()}
      >
        {text("Refresh job status", "تحديث حالة المهام")}
      </button>
      {busy && (
        <p role="status">
          {text("Loading scheduled work…", "جارٍ تحميل المهام المجدولة…")}
        </p>
      )}
      {error && (
        <p role="alert">
          {text(
            "Status unavailable or access changed. Refresh after verifying your owner session.",
            "الحالة غير متاحة أو تغيّرت الصلاحيات. حدّث الصفحة بعد التحقق من جلسة المالك.",
          )}
        </p>
      )}
      {status && health && (
        <>
          <p role="status">
            <strong>{labels[health]}</strong>
          </p>
          <dl className="ops-details">
            <dt>{text("Pending / retry", "قيد الانتظار / إعادة المحاولة")}</dt>
            <dd>
              {status.counts.pending || 0} / {status.counts.retry || 0}
            </dd>
            <dt>{text("Failed after retries", "فشلت بعد إعادة المحاولة")}</dt>
            <dd>{status.counts.failed || 0}</dd>
            <dt>
              {text(
                "Expired offers awaiting staff review",
                "عروض منتهية بانتظار مراجعة الموظفين",
              )}
            </dt>
            <dd>{status.counts.staff_review || 0}</dd>
            <dt>
              {text(
                "Last successful item · Dubai time",
                "آخر مهمة ناجحة · بتوقيت دبي",
              )}
            </dt>
            <dd>
              {status.last_success
                ? format(status.last_success)
                : text("No successful run recorded", "لم يُسجّل تشغيل ناجح")}
            </dd>
          </dl>
          {status.recent_runs.length > 0 && (
            <details>
              <summary>
                {text(
                  "Recent run outcomes (latest 50)",
                  "نتائج التشغيل الأخيرة (آخر ٥٠)",
                )}
              </summary>
              <ul>
                {status.recent_runs.map((run) => (
                  <li key={run.id}>
                    <time dateTime={run.finished_at}>
                      {format(run.finished_at)}
                    </time>
                    {" · "}
                    <bdi>
                      {run.kind} · {run.outcome}
                      {run.error_code ? ` · ${run.error_code}` : ""}
                    </bdi>
                    {" · "}
                    {run.affected}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p>
            {text(
              "Activation and recovery require a reviewed owner operation. Expired offers remain in the staff queue; no next child is booked automatically.",
              "يتطلب التفعيل والاستعادة إجراءً معتمداً من المالك. تبقى العروض المنتهية في قائمة الموظفين؛ ولا يُحجز الطفل التالي تلقائياً.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
