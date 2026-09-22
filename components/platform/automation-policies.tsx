"use client";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { api } from "@/lib/platform/client";
import {
  records,
  value,
  type PortalRow,
  type PortalData,
} from "@/lib/platform/portal-model";
import type { AccountContext } from "@/lib/platform/contracts";
export function AutomationPolicies({
  data,
  account,
  refresh,
}: {
  data: PortalData;
  account: AccountContext;
  refresh: () => Promise<void>;
}) {
  const { locale } = useLocale();
  const ar = locale === "ar";
  const t = (en: string, arabic: string) => (ar ? arabic : en);
  const [branch, setBranch] = useState("");
  const [kind, setKind] = useState("monthly_report");
  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const policies = [
    ...records(data, "development_automation_policies"),
    ...records(data, "coach_message_policies").map((p): PortalRow => ({
      ...p,
      kind: "coach_messages",
    })),
  ].filter((p) => !branch || p.branch_id === branch);
  return (
    <section className="ops-editor">
      <h2>{t("Workflow policies", "سياسات سير العمل")}</h2>
      <p>
        {t(
          "These policies apply only to confirmed synthetic branches. Scheduled execution needs a separate current scheduler approval. Payment and WhatsApp remain inactive.",
          "تنطبق هذه السياسات فقط على الفروع التجريبية المؤكدة. يحتاج التشغيل المجدول إلى موافقة مستقلة وسارية. تظل المدفوعات وواتساب غير مفعّلين.",
        )}
      </p>
      {account.aal !== "aal2" && (
        <p>
          {t(
            "Verify your authenticator session before changing policy. The local demo exemption does not authorize policy activation.",
            "تحقق من جلسة المصادقة قبل تغيير السياسة. لا يسمح الاستثناء التجريبي المحلي بتفعيل السياسات.",
          )}
        </p>
      )}
      <label>
        {t("Branch", "الفرع")}
        <select value={branch} onChange={(e) => setBranch(e.target.value)}>
          <option value="">{t("Choose branch", "اختر الفرع")}</option>
          {records(data, "branches")
            .filter((b) => b.synthetic && b.active && !b.provisional)
            .map((b) => (
              <option value={String(b.id)} key={String(b.id)}>
                {value(b, ar ? "name_ar" : "name") || value(b, "name")}
              </option>
            ))}
        </select>
      </label>
      <label>
        {t("Workflow", "سير العمل")}
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="monthly_report">
            {t("Monthly report drafts", "مسودات التقارير الشهرية")}
          </option>
          <option value="completion_certificate">
            {t("Approved progression certificates", "شهادات التقدم المعتمد")}
          </option>
          <option value="coach_messages">
            {t(
              "Coach messages with operations review",
              "رسائل المدرب مع مراجعة العمليات",
            )}
          </option>
        </select>
      </label>
      {kind !== "coach_messages" && (
        <label>
          {t("Report / certificate title", "عنوان التقرير أو الشهادة")}
          <input
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      )}
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {t("Enable this synthetic policy", "تفعيل السياسة التجريبية")}
      </label>
      <button
        disabled={
          busy ||
          account.aal !== "aal2" ||
          !branch ||
          (kind !== "coach_messages" && title.trim().length < 2)
        }
        onClick={async () => {
          setBusy(true);
          const r =
            kind === "coach_messages"
              ? await api("coach-conversations", {
                  key: crypto.randomUUID(),
                  command: {
                    action: "policy",
                    data: { branch_id: branch, enabled, review_required: true },
                  },
                })
              : await api("development-automation", {
                  branch,
                  kind,
                  enabled,
                  title,
                });
          setBusy(false);
          if (r.ok) {
            setMessage(
              t(
                "Policy version saved. No external delivery enabled.",
                "حُفظ إصدار السياسة. لم يُفعّل الإرسال الخارجي.",
              ),
            );
            await refresh();
          } else setMessage(r.message);
        }}
      >
        {t("Save policy version", "حفظ إصدار السياسة")}
      </button>
      <p role="status">{message}</p>
      <ul>
        {policies.map((p) => (
          <li key={String(p.id)}>
            {p.kind === "monthly_report"
              ? t("Monthly report", "التقرير الشهري")
              : p.kind === "completion_certificate"
                ? t("Certificate", "الشهادة")
                : t("Coach messages", "رسائل المدرب")}{" "}
            · {t("Version", "الإصدار")} {String(p.version)} ·{" "}
            {p.enabled ? t("Enabled", "مفعّل") : t("Disabled", "معطّل")}
          </li>
        ))}
      </ul>
    </section>
  );
}
