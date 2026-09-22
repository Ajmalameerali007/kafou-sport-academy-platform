"use client";
import { administratorVerified } from "@/lib/platform/contracts";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import {
  targetBaselineChoices,
  targetCompletionResults,
} from "@/lib/platform/development-targets";
import type { ProductRow } from "@/lib/platform/product";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductField,
  type ProductProps,
} from "./product-shared";

const stateLabels: Record<string, string> = {
  draft: "Target draft",
  submitted: "Target awaiting review",
  approved: "Target approved",
  rejected: "Target returned for revision",
  published: "Active target",
  completion_submitted: "Completion awaiting review",
  completed: "Target completed",
  withdrawn: "Target withdrawn",
  completion_rejected: "Completion returned for revision",
};
const targetFields: ProductField[] = [
  {
    name: "title",
    label: "Measurable training goal",
    type: "textarea",
    required: true,
  },
  {
    name: "target_value",
    label: "Target measurement",
    type: "number",
    step: "any",
    required: true,
  },
  { name: "due_on", label: "Target date", type: "date", required: true },
];
const reviewFields: ProductField[] = [
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
    type: "textarea",
    required: true,
  },
];
export function DevelopmentTargetsPanel({
  account,
  data,
  refresh,
  childId = "",
  sport = "",
}: ProductProps & { childId?: string; sport?: string }) {
  const { t, locale } = useLocale();
  const [baselineId, setBaselineId] = useState("");
  const all = (name: string) => data[name] ?? [];
  const sessions = all("development_sessions");
  const names = new Map<string, string>();
  all("children").forEach((row) => names.set(val(row, "id"), val(row, "name")));
  sessions.forEach((session) => {
    if (Array.isArray(session.students))
      session.students.forEach((child) => names.set(child.id, child.name));
  });
  const childName = (value: unknown) =>
    names.get(String(value)) ?? t("Athlete");
  const selected = (row: ProductRow) =>
    (!childId || row.child_id === childId) && (!sport || row.sport === sport);
  const choices = targetBaselineChoices(data).filter((choice) =>
    selected(choice.result),
  );
  const baseline = choices.find((choice) => choice.result.id === baselineId);
  const targets = all("development_targets").filter(selected);
  const hasSales = account.roles.includes("sales");
  const coach = account.roles.includes("coach") && !hasSales;
  const head =
    account.roles.some((role) => role === "admin" || role === "super_admin") &&
    !hasSales;
  const can = (permission: string, sessionId: unknown) => {
    const session =
      sessions.find((row) => row.id === sessionId) ??
      all("class_sessions").find((row) => row.id === sessionId);
    const branch =
      session?.branch_id ??
      all("academy_classes").find((row) => row.id === session?.class_id)
        ?.branch_id;
    return (
      head &&
      ((account.roles.includes("super_admin") &&
        administratorVerified(account)) ||
        all("product_permissions").some(
          (row) =>
            row.permission === permission &&
            (row.branch_id == null || row.branch_id === branch),
        ))
    );
  };
  const assigned = (target: ProductRow) =>
    coach &&
    sessions.some(
      (session) =>
        session.id === target.session_id &&
        session.can_coach === true &&
        session.status !== "cancelled" &&
        Array.isArray(session.students) &&
        session.students.some((child) => child.id === target.child_id),
    );
  const metric = (row: ProductRow) =>
    locale === "ar" && row.label_ar ? val(row, "label_ar") : val(row, "label");
  const date = (value: unknown) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      dateStyle: "medium",
      timeZone: "Asia/Dubai",
    }).format(new Date(String(value)));
  return (
    <section className="portal-card">
      <h3>{t("Tracked training targets")}</h3>
      <p>
        {t(
          "Each goal keeps its published baseline, measurement and target date. Later published evidence is checked independently before completion is confirmed.",
        )}
      </p>
      {coach && (
        <details className="ops-editor">
          <summary>{t("Create tracked target")}</summary>
          {choices.length ? (
            <>
              <label>
                {t("Published baseline measurement")}
                <select
                  value={baselineId}
                  onChange={(event) => setBaselineId(event.target.value)}
                >
                  <option value="">{t("Choose")}</option>
                  {choices.map(({ result }) => (
                    <option key={val(result, "id")} value={val(result, "id")}>
                      {childName(result.child_id)} · {metric(result)} ·{" "}
                      {val(result, "value")} {val(result, "unit")} ·{" "}
                      {date(result.measured_at)}
                    </option>
                  ))}
                </select>
              </label>
              {baseline && (
                <>
                  <p>
                    {t(
                      "The target must improve this baseline within the same criterion range. Choose a date within the next 366 days.",
                    )}
                  </p>
                  <ProductForm
                    key={val(baseline.result, "id")}
                    title="Draft training target"
                    action="development.target.save"
                    initial={{
                      session_id: baseline.session.id,
                      baseline_result_id: baseline.result.id,
                    }}
                    fields={targetFields}
                    onSaved={refresh}
                    submitLabel="Save target draft"
                  />
                </>
              )}
            </>
          ) : (
            <ProductNotice>
              {t(
                "A published measurement for an assigned athlete is needed before creating a tracked target.",
              )}
            </ProductNotice>
          )}
        </details>
      )}
      {!targets.length && (
        <ProductNotice>
          {t("No tracked targets in this view yet.")}
        </ProductNotice>
      )}
      {targets.map((target) => {
        const ownDraft =
          assigned(target) &&
          target.author_id === account.userId &&
          ["draft", "rejected"].includes(val(target, "status"));
        const completions = assigned(target)
          ? targetCompletionResults(target, data)
          : [];
        const proof = all("development_results").find(
          (row) => row.id === target.completion_result_id,
        );
        const history = all("development_target_events")
          .filter((row) => row.target_id === target.id)
          .sort((a, b) =>
            String(a.created_at).localeCompare(String(b.created_at)),
          );
        const reviews = all("development_target_reviews").filter(
          (row) => row.target_id === target.id,
        );
        return (
          <article className="ops-editor" key={val(target, "id")}>
            <h4>
              {childName(target.child_id)} · {val(target, "title")}
            </h4>
            <p>
              <span className="status-pill">
                {t(stateLabels[val(target, "status")] ?? "Training target")}
              </span>{" "}
              · {t(val(target, "sport"))}
            </p>
            <dl className="ops-form-grid">
              <div>
                <dt>{t("Baseline")}</dt>
                <dd>
                  {metric(target)} · {val(target, "baseline_value")}{" "}
                  {val(target, "unit")}
                </dd>
              </div>
              <div>
                <dt>{t("Target measurement")}</dt>
                <dd>
                  {target.direction === "lower" ? "≤" : "≥"}{" "}
                  {val(target, "target_value")} {val(target, "unit")}
                </dd>
              </div>
              <div>
                <dt>{t("Target date")}</dt>
                <dd>{date(target.due_on)}</dd>
              </div>
            </dl>
            {proof && (
              <p>
                {t("Completion evidence")}: {val(proof, "value")}{" "}
                {val(proof, "unit")} · {date(proof.measured_at)}
              </p>
            )}
            {Boolean(target.withdrawal_reason) && (
              <ProductNotice>{val(target, "withdrawal_reason")}</ProductNotice>
            )}
            {ownDraft && (
              <details>
                <summary>{t("Edit target draft")}</summary>
                <ProductForm
                  title="Edit target draft"
                  action="development.target.save"
                  initial={{
                    id: target.id,
                    session_id: target.session_id,
                    baseline_result_id: target.baseline_result_id,
                    title: target.title,
                    target_value: target.target_value,
                    due_on: target.due_on,
                  }}
                  fields={targetFields}
                  onSaved={refresh}
                />
              </details>
            )}
            {assigned(target) &&
              target.author_id === account.userId &&
              target.status === "draft" && (
                <ProductForm
                  title="Submit target for review"
                  action="development.target.submit"
                  initial={{ id: target.id }}
                  fields={[]}
                  onSaved={refresh}
                  submitLabel="Submit for review"
                />
              )}
            {target.status === "submitted" &&
              target.author_id !== account.userId &&
              can("development.review", target.session_id) && (
                <ProductForm
                  title="Review training target"
                  action="development.target.review"
                  initial={{ id: target.id }}
                  fields={reviewFields}
                  onSaved={refresh}
                />
              )}
            {target.status === "approved" &&
              target.author_id !== account.userId &&
              can("development.publish", target.session_id) && (
                <ProductForm
                  title="Publish training target"
                  action="development.target.publish"
                  initial={{ id: target.id }}
                  fields={[]}
                  onSaved={refresh}
                  submitLabel="Publish to family"
                />
              )}
            {target.status === "published" &&
              assigned(target) &&
              (completions.length ? (
                <ProductForm
                  title="Submit target completion"
                  action="development.target.completion.submit"
                  initial={{ id: target.id }}
                  fields={[
                    {
                      name: "result_id",
                      label: "Later published measurement",
                      required: true,
                      options: completions.map((row) => ({
                        value: val(row, "id"),
                        label: `${metric(row)} · ${val(row, "value")} ${val(row, "unit")} · ${date(row.measured_at)}`,
                      })),
                    },
                  ]}
                  onSaved={refresh}
                  submitLabel="Submit completion evidence"
                />
              ) : (
                <ProductNotice>
                  {t(
                    "Completion needs a later measurement in this exact metric version, published after the target, that reaches the goal.",
                  )}
                </ProductNotice>
              ))}
            {target.status === "completion_submitted" &&
              target.author_id !== account.userId &&
              target.completion_by !== account.userId &&
              can("development.review", target.session_id) && (
                <ProductForm
                  title="Review target completion"
                  action="development.target.completion.review"
                  initial={{ id: target.id }}
                  fields={reviewFields}
                  onSaved={refresh}
                />
              )}
            {["published", "completion_submitted", "completed"].includes(
              val(target, "status"),
            ) &&
              can("development.publish", target.session_id) && (
                <details>
                  <summary>{t("Withdraw training target")}</summary>
                  <ProductForm
                    title="Withdraw training target"
                    action="development.target.withdraw"
                    initial={{ id: target.id }}
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
              )}
            {reviews.length > 0 && (
              <details>
                <summary>{t("Internal target review history")}</summary>
                {reviews.map((review) => (
                  <p key={val(review, "id")}>
                    {t(
                      review.stage === "completion"
                        ? "Completion evidence"
                        : "Training target",
                    )}{" "}
                    ·{" "}
                    {t(
                      review.decision === "approved"
                        ? "Approve"
                        : "Return for revision",
                    )}{" "}
                    · {val(review, "reason")}
                  </p>
                ))}
              </details>
            )}
            {history.length > 0 && (
              <details>
                <summary>{t("Target history")}</summary>
                <ol>
                  {history.map((event) => (
                    <li key={val(event, "id")}>
                      {t(
                        stateLabels[val(event, "action")] ?? "Training target",
                      )}{" "}
                      · {date(event.created_at)}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}
