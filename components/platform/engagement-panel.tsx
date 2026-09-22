"use client";
import { administratorVerified } from "@/lib/platform/contracts";
import { useRef, useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import { engagementSchema, rewardBalance } from "@/lib/platform/engagement";
import { productCommand, type ProductRow } from "@/lib/platform/product";
import {
  ProductForm,
  ProductNotice,
  val,
  type ProductProps,
} from "./product-shared";
import { StatusBadge, announceSaved } from "./portal-ui";
const sports = ["swimming", "football", "karate", "badminton"];
function ChallengeCreator({
  data,
  refresh,
}: Pick<ProductProps, "data" | "refresh">) {
  const { t } = useLocale();
  const [kind, setKind] = useState("attendance"),
    [sport, setSport] = useState("swimming"),
    [criteriaId, setCriteriaId] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const key = useRef(crypto.randomUUID()),
    last = useRef("");
  const standard = data.development_criteria?.find((c) => c.id === criteriaId);
  const metrics = (
    Array.isArray(standard?.criteria) ? standard.criteria : []
  ) as ProductRow[];
  return (
    <form
      className="ops-editor product-form"
      aria-busy={busy}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget,
          f = new FormData(form);
        const payload = {
          branch_id: f.get("branch_id"),
          sport,
          title: f.get("title"),
          description: f.get("description"),
          starts_at: new Date(
            String(f.get("starts_at")) + "+04:00",
          ).toISOString(),
          ends_at: new Date(String(f.get("ends_at")) + "+04:00").toISOString(),
          reward_policy_id: f.get("reward_policy_id"),
          ...(f.get("level_id") ? { level_id: f.get("level_id") } : {}),
          rule:
            kind === "attendance"
              ? { kind, count: Number(f.get("count")) }
              : {
                  kind,
                  criteria_id: criteriaId,
                  metric_key: f.get("metric_key"),
                  target: Number(f.get("target")),
                },
        };
        const checked = engagementSchema.safeParse({
          action: "engagement.challenge.create",
          data: payload,
        });
        if (!checked.success) {
          setMessage(t("Check the rule, required fields and challenge dates."));
          return;
        }
        const fingerprint = JSON.stringify(checked.data);
        if (last.current && last.current !== fingerprint)
          key.current = crypto.randomUUID();
        last.current = fingerprint;
        setBusy(true);
        const result = await productCommand(
          checked.data.action,
          checked.data.data,
          key.current,
        );
        setBusy(false);
        setMessage(t(result.ok ? "Saved" : result.message));
        if (result.ok) {
          key.current = crypto.randomUUID();
          announceSaved(form);
          refresh();
        }
      }}
    >
      <h3>{t("Create challenge")}</h3>
      <p>
        {t(
          "Rules are locked when published. Qualifying evidence must fall inside the challenge dates.",
        )}
      </p>
      <div className="ops-form-grid">
        <label>
          {t("Branch")}
          <select name="branch_id" required>
            <option value="">{t("Choose")}</option>
            {(data.branches ?? []).map((b) => (
              <option key={val(b, "id")} value={val(b, "id")}>
                {val(b, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Sport")}
          <select
            value={sport}
            onChange={(e) => {
              setSport(e.target.value);
              setCriteriaId("");
            }}
          >
            {sports.map((s) => (
              <option key={s} value={s}>
                {t(s)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Level eligibility")}
          <select name="level_id" key={sport}>
            <option value="">{t("All levels")}</option>
            {(data.sport_levels ?? [])
              .filter((l) => l.sport === sport && l.active !== false)
              .map((l) => (
                <option key={val(l, "id")} value={val(l, "id")}>
                  {val(l, "name")}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t("Challenge title")}
          <input name="title" required minLength={2} maxLength={120} />
        </label>
        <label>
          {t("Starts at (Dubai time)")}
          <input name="starts_at" type="datetime-local" required />
        </label>
        <label>
          {t("Ends at (Dubai time)")}
          <input name="ends_at" type="datetime-local" required />
        </label>
        <label>
          {t("Reward rule")}
          <select name="reward_policy_id" required>
            <option value="">{t("Choose")}</option>
            {(data.engagement_reward_rules ?? [])
              .filter((r) => r.source_kind === "challenge" && r.published_at)
              .map((r) => (
                <option key={val(r, "id")} value={val(r, "id")}>
                  {val(r, "title")} · {val(r, "quantity")} {t(val(r, "unit"))}
                </option>
              ))}
          </select>
        </label>
        <label>
          {t("Completion rule")}
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="attendance">{t("Finalized attendance")}</option>
            <option value="metric">{t("Published sport measurement")}</option>
          </select>
        </label>
        {kind === "attendance" ? (
          <label>
            {t("Required attended sessions")}
            <input
              name="count"
              type="number"
              required
              min={1}
              max={200}
              step={1}
            />
          </label>
        ) : (
          <>
            <label>
              {t("Criteria version")}
              <select
                value={criteriaId}
                onChange={(e) => setCriteriaId(e.target.value)}
                required
              >
                <option value="">{t("Choose")}</option>
                {(data.development_criteria ?? [])
                  .filter((c) => c.sport === sport)
                  .map((c) => (
                    <option key={val(c, "id")} value={val(c, "id")}>
                      {val(c, "title")} · {t("Version")} {val(c, "version")}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {t("Metric")}
              <select name="metric_key" required key={criteriaId}>
                <option value="">{t("Choose")}</option>
                {metrics.map((m) => (
                  <option key={val(m, "key")} value={val(m, "key")}>
                    {val(m, "label")} ({val(m, "unit")})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("Target value")}
              <input name="target" type="number" step="any" required />
            </label>
          </>
        )}
      </div>
      <label>
        {t("Transparent challenge rules")}
        <textarea name="description" required minLength={5} maxLength={2000} />
      </label>
      <button className="button button-green" disabled={busy}>
        {t(busy ? "Saving…" : "Create draft")}
      </button>
      {message && <ProductNotice>{message}</ProductNotice>}
    </form>
  );
}
function ReferralCampaignCreator({
  data,
  refresh,
}: Pick<ProductProps, "data" | "refresh">) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const key = useRef(crypto.randomUUID()),
    previous = useRef("");
  return (
    <form
      className="ops-editor product-form"
      aria-busy={busy}
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.currentTarget;
        const f = new FormData(form);
        const parsed = engagementSchema.safeParse({
          action: "engagement.referral_campaign.create",
          data: {
            branch_id: f.get("branch_id"),
            title: f.get("title"),
            description: f.get("description"),
            starts_at: new Date(
              String(f.get("starts_at")) + "+04:00",
            ).toISOString(),
            ends_at: new Date(
              String(f.get("ends_at")) + "+04:00",
            ).toISOString(),
            reward_policy_id: f.get("reward_policy_id"),
          },
        });
        if (!parsed.success) {
          setMessage(t("Check the rule, required fields and challenge dates."));
          return;
        }
        const fingerprint = JSON.stringify(parsed.data);
        if (previous.current && previous.current !== fingerprint)
          key.current = crypto.randomUUID();
        previous.current = fingerprint;
        setBusy(true);
        const result = await productCommand(
          parsed.data.action,
          parsed.data.data,
          key.current,
        );
        setBusy(false);
        setMessage(t(result.ok ? "Saved" : result.message));
        if (result.ok) {
          key.current = crypto.randomUUID();
          announceSaved(form);
          refresh();
        }
      }}
    >
      <h3>{t("Create referral campaign")}</h3>
      <div className="ops-form-grid">
        <label>
          {t("Branch")}
          <select name="branch_id" required>
            <option value="">{t("Choose")}</option>
            {(data.branches ?? []).map((b) => (
              <option key={val(b, "id")} value={val(b, "id")}>
                {val(b, "name")}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Campaign title")}
          <input name="title" required minLength={2} maxLength={120} />
        </label>
        <label>
          {t("Starts at (Dubai time)")}
          <input name="starts_at" type="datetime-local" required />
        </label>
        <label>
          {t("Ends at (Dubai time)")}
          <input name="ends_at" type="datetime-local" required />
        </label>
        <label>
          {t("Reward rule")}
          <select name="reward_policy_id" required>
            <option value="">{t("Choose")}</option>
            {(data.engagement_reward_rules ?? [])
              .filter((r) => r.source_kind === "referral" && r.published_at)
              .map((r) => (
                <option key={val(r, "id")} value={val(r, "id")}>
                  {val(r, "title")}
                </option>
              ))}
          </select>
        </label>
      </div>
      <label>
        {t("Transparent referral rules")}
        <textarea name="description" required minLength={5} maxLength={2000} />
      </label>
      <button className="button button-green" disabled={busy}>
        {t(busy ? "Saving…" : "Create draft")}
      </button>
      {message && <ProductNotice>{message}</ProductNotice>}
    </form>
  );
}
export function EngagementPanel({ account, data, refresh }: ProductProps) {
  const { t, locale } = useLocale();
  const [renderTime] = useState(() => Date.now());
  const [childId, setChildId] = useState("");
  const all = (k: string) => data[k] ?? [];
  const head = account.roles.some((r) => r === "admin" || r === "super_admin");
  const can = (permission: string, branch?: unknown) =>
    head &&
    ((account.roles.includes("super_admin") &&
      administratorVerified(account)) ||
      all("product_permissions").some(
        (p) =>
          p.permission === permission &&
          (p.branch_id == null || p.branch_id === branch),
      ));
  const configure =
    head &&
    (account.roles.includes("super_admin") ||
      all("product_permissions").some(
        (p) => p.permission === "engagement.configure",
      ));
  const nameMap = new Map<string, string>();
  all("children").forEach((k) => nameMap.set(val(k, "id"), val(k, "name")));
  all("development_sessions")
    .filter((s) => s.can_coach)
    .forEach((s) =>
      (Array.isArray(s.students) ? (s.students as ProductRow[]) : []).forEach(
        (k) => nameMap.set(val(k, "id"), val(k, "name")),
      ),
    );
  const athlete = (id: unknown) => nameMap.get(String(id)) || t("Athlete");
  const family = (id: unknown) =>
    val(
      all("families").find((f) => f.id === id),
      "name",
    ) || t("Family");
  const options = (items: ProductRow[], label = "name") =>
    items.map((r) => ({ value: val(r, "id"), label: val(r, label) }));
  const branchOptions = options(all("branches")),
    familyOptions = options(all("families")),
    athleteOptions = [...nameMap].map(([value, label]) => ({ value, label }));
  const rules = all("engagement_reward_rules"),
    challenges = all("engagement_challenges"),
    entries = all("engagement_entries").filter(
      (e) => !childId || e.child_id === childId,
    );
  const ledger = all("engagement_reward_ledger").filter(
    (r) => !childId || r.child_id == null || r.child_id === childId,
  );
  const ruleName = (id: unknown) =>
    val(
      rules.find((p) => p.id === id),
      "title",
    );
  const date = (value: unknown) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-AE" : "en-AE", {
      timeZone: "Asia/Dubai",
      dateStyle: "medium",
    }).format(new Date(String(value)));
  const reviewFields = [
    {
      name: "decision",
      label: "Qualification decision",
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
  const reasonField = [
    {
      name: "reason",
      label: "Family-facing reason",
      type: "textarea",
      required: true,
    },
  ];
  return (
    <div className="product-workspace">
      <div className="portal-section-heading">
        <div>
          <p className="eyebrow">{t("EFFORT. EVIDENCE. ENCOURAGEMENT.")}</p>
          <h2>{t("Challenges and rewards")}</h2>
          <p>
            {t(
              "Clear rules, reviewed achievements and non-cash academy rewards.",
            )}
          </p>
        </div>
      </div>
      <label>
        {t("Athlete")}
        <select value={childId} onChange={(e) => setChildId(e.target.value)}>
          <option value="">{t("All athletes in this view")}</option>
          {athleteOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <section className="portal-card">
        <h3>{t("Academy challenges")}</h3>
        <p>
          {t(
            "Evidence within the challenge dates counts, including sessions before joining. Request review within 30 days after the challenge ends.",
          )}
        </p>
        {challenges.length ? (
          challenges.map((c) => {
            const rule = c.rule as ProductRow;
            const standard = all("development_criteria").find(
              (v) => v.id === rule.criteria_id,
            );
            const metrics = (
              Array.isArray(standard?.criteria) ? standard.criteria : []
            ) as ProductRow[];
            const metric = metrics.find((m) => m.key === rule.metric_key);
            const mine = entries.filter((e) => e.challenge_id === c.id);
            const ended = new Date(String(c.ends_at)).getTime() <= renderTime;
            return (
              <article className="ops-editor" key={val(c, "id")}>
                <h4>
                  {val(c, "title")} · {t(val(c, "sport"))}
                </h4>
                <StatusBadge status={c.published_at ? "published" : "draft"} />
                <p>{val(c, "description")}</p>
                <p>
                  {date(c.starts_at)} – {date(c.ends_at)}
                </p>
                <p>
                  {rule.kind === "attendance"
                    ? `${t("Required attended sessions")}: ${val(rule, "count")} · ${t("Present or late, finalized attendance only.")}`
                    : `${val(metric, "label")}: ${val(metric, "direction") === "lower" ? "≤" : "≥"} ${val(rule, "target")} ${val(metric, "unit")} · ${t("Published measurements only.")}`}
                </p>
                <p>
                  {t("Reward")}: {ruleName(c.reward_policy_id)}
                </p>
                {!c.published_at &&
                  can("engagement.configure", c.branch_id) && (
                    <ProductForm
                      title="Publish challenge"
                      action="engagement.challenge.publish"
                      initial={{ id: c.id }}
                      fields={[]}
                      onSaved={refresh}
                    />
                  )}{" "}
                {Boolean(c.published_at) &&
                  !ended &&
                  athleteOptions.length > 0 && (
                    <ProductForm
                      title="Join challenge"
                      action="engagement.challenge.join"
                      initial={{ challenge_id: c.id }}
                      fields={[
                        {
                          name: "child_id",
                          label: "Athlete",
                          required: true,
                          options: athleteOptions.filter(
                            (o) => !mine.some((e) => e.child_id === o.value),
                          ),
                        },
                      ]}
                      onSaved={refresh}
                    />
                  )}
                {mine.map((e) => (
                  <div key={val(e, "id")}>
                    <p>
                      {athlete(e.child_id)} ·{" "}
                      <StatusBadge status={val(e, "status")} />
                    </p>
                    {e.status === "joined" && (
                      <ProductForm
                        title="Request completion review"
                        action="engagement.completion.submit"
                        initial={{ entry_id: e.id }}
                        fields={[]}
                        onSaved={refresh}
                      />
                    )}
                  </div>
                ))}
              </article>
            );
          })
        ) : (
          <ProductNotice>
            {t("Published challenges will appear here.")}
          </ProductNotice>
        )}
      </section>
      <section className="portal-card">
        <h3>{t("Completion evidence and review")}</h3>
        {all("engagement_completions")
          .filter((c) => entries.some((e) => e.id === c.entry_id))
          .map((c) => {
            const entry = entries.find((e) => e.id === c.entry_id),
              challenge = challenges.find((x) => x.id === entry?.challenge_id),
              proof = c.evidence as ProductRow;
            return (
              <article className="ops-editor" key={val(c, "id")}>
                <h4>
                  {athlete(entry?.child_id)} · {val(challenge, "title")}
                </h4>
                <StatusBadge status={val(c, "status")} />
                <p>
                  {proof.kind === "attendance"
                    ? `${t("Verified attendance")}: ${val(proof, "count")} / ${val(proof, "required")}`
                    : `${t("Verified measurement target")}: ${val(proof, "target")} ${val(proof, "unit")}`}
                </p>
                {all("engagement_reviews")
                  .filter((r) => r.completion_id === c.id)
                  .map((r) => (
                    <p key={val(r, "id")}>
                      {t("Review")}: {t(val(r, "decision"))} ·{" "}
                      {val(r, "reason")}
                    </p>
                  ))}
                {c.status === "submitted" &&
                  c.submitted_by !== account.userId &&
                  can("engagement.review", challenge?.branch_id) && (
                    <ProductForm
                      title="Review challenge completion"
                      action="engagement.completion.review"
                      initial={{ id: c.id }}
                      fields={reviewFields}
                      onSaved={refresh}
                    />
                  )}{" "}
                {c.status === "approved" &&
                  can("engagement.grant", challenge?.branch_id) && (
                    <ProductForm
                      title="Grant challenge reward"
                      action="engagement.reward.grant"
                      initial={{ source_kind: "challenge", source_id: c.id }}
                      fields={reasonField}
                      onSaved={refresh}
                    />
                  )}
              </article>
            );
          })}
        {!all("engagement_completions").length && (
          <ProductNotice>
            {t(
              "Reviewed achievements will appear here. Internal reviews stay private.",
            )}
          </ProductNotice>
        )}
      </section>
      <section className="portal-card">
        <h3>{t("Reward ledger")}</h3>
        <p>
          {t(
            "Badges, stars and points have no cash value. Corrections remain visible in the history.",
          )}
        </p>
        {ledger.length ? (
          <>
            <dl className="ops-form-grid">
              {rewardBalance(
                ledger.map((r) => ({
                  policy_id: val(r, "policy_id"),
                  unit: val(r, "unit"),
                  delta: Number(r.delta),
                })),
              ).map((b) => (
                <div key={`${b.policy_id}:${b.unit}`}>
                  <dt>{ruleName(b.policy_id)}</dt>
                  <dd>
                    {b.balance} {t(b.unit)}
                  </dd>
                </div>
              ))}
            </dl>
            {ledger.map((r) => (
              <article key={val(r, "id")} className="ops-editor">
                <h4>
                  {r.child_id ? athlete(r.child_id) : t("Family reward")} ·{" "}
                  {ruleName(r.policy_id)}
                </h4>
                <p>
                  {Number(r.delta) > 0 ? "+" : ""}
                  {val(r, "delta")} {t(val(r, "unit"))} · {date(r.created_at)}
                </p>
                <p>{val(r, "reason")}</p>
                {r.kind === "grant" &&
                  !ledger.some((x) => x.reversal_of === r.id) &&
                  can(
                    "engagement.grant",
                    rules.find((p) => p.id === r.policy_id)?.branch_id,
                  ) && (
                    <details>
                      <summary>{t("Reverse reward")}</summary>
                      <ProductForm
                        title="Reverse reward"
                        action="engagement.reward.reverse"
                        initial={{ id: r.id }}
                        fields={reasonField}
                        onSaved={refresh}
                      />
                    </details>
                  )}
              </article>
            ))}
          </>
        ) : (
          <ProductNotice>
            {t("No reward grants in this view yet.")}
          </ProductNotice>
        )}
      </section>
      {head && (
        <section className="portal-card">
          <h3>{t("Approved recognition rewards")}</h3>
          <p>
            {t(
              "Rewards reference the academy recognition review. No second nomination is created.",
            )}
          </p>
          {all("recognition_nominations")
            .filter(
              (n) =>
                n.status === "approved" &&
                (!childId || n.child_id === childId) &&
                can("engagement.grant", n.branch_id),
            )
            .map((n) => (
              <article key={val(n, "id")} className="ops-editor">
                <h4>
                  {athlete(n.child_id)} · {val(n, "title")}
                </h4>
                {all("engagement_reward_ledger").some(
                  (r) => r.recognition_id === n.id,
                ) ? (
                  <p>{t("Reward already recorded")}</p>
                ) : (
                  <ProductForm
                    title="Grant recognition reward"
                    action="engagement.reward.grant"
                    initial={{ source_kind: "recognition", source_id: n.id }}
                    fields={[
                      {
                        name: "reward_policy_id",
                        label: "Reward rule",
                        required: true,
                        options: options(
                          rules.filter(
                            (p) =>
                              p.source_kind === "recognition" &&
                              p.branch_id === n.branch_id &&
                              p.published_at,
                          ),
                          "title",
                        ),
                      },
                      ...reasonField,
                    ]}
                    onSaved={refresh}
                  />
                )}
              </article>
            ))}
        </section>
      )}
      <section className="portal-card">
        <h3>{t("Family referrals")}</h3>
        <p>
          {t(
            "Referral credit requires another family’s first fully paid membership after code entry, followed by academy review. No cash payout.",
          )}
        </p>
        {all("engagement_referral_campaigns").map((c) => (
          <article key={val(c, "id")} className="ops-editor">
            <h4>{val(c, "title")}</h4>
            <p>{val(c, "description")}</p>
            <p>
              {date(c.starts_at)} – {date(c.ends_at)} ·{" "}
              {ruleName(c.reward_policy_id)}
            </p>
            {!c.published_at && can("engagement.configure", c.branch_id) && (
              <ProductForm
                title="Publish referral campaign"
                action="engagement.referral_campaign.publish"
                initial={{ id: c.id }}
                fields={[]}
                onSaved={refresh}
              />
            )}{" "}
            {Boolean(c.published_at) &&
              account.roles.includes("parent") &&
              familyOptions.length > 0 && (
                <ProductForm
                  title="Get family referral code"
                  action="engagement.referral.code"
                  initial={{ campaign_id: c.id }}
                  fields={[
                    {
                      name: "family_id",
                      label: "Family",
                      required: true,
                      options: familyOptions,
                    },
                  ]}
                  onSaved={refresh}
                />
              )}
          </article>
        ))}
        {all("engagement_referral_codes")
          .filter((code) => !head || code.created_by === account.userId)
          .map((code) => (
            <p key={val(code, "id")}>
              {t("Your referral code")}:{" "}
              <strong dir="ltr">{val(code, "code")}</strong>
            </p>
          ))}
        {account.roles.includes("parent") && familyOptions.length > 0 && (
          <ProductForm
            title="Enter a referral code"
            action="engagement.referral.redeem"
            fields={[
              {
                name: "family_id",
                label: "Family",
                required: true,
                options: familyOptions,
              },
              { name: "code", label: "Referral code", required: true },
            ]}
            onSaved={refresh}
          />
        )}
      </section>
      {head && all("engagement_referral_claims").length > 0 && (
        <section className="portal-card">
          <h3>{t("Referral qualification")}</h3>
          {all("engagement_referral_claims").map((r) => {
            const code = all("engagement_referral_codes").find(
                (c) => c.id === r.code_id,
              ),
              campaign = all("engagement_referral_campaigns").find(
                (c) => c.id === code?.campaign_id,
              );
            return (
              <article className="ops-editor" key={val(r, "id")}>
                <h4>
                  {family(r.referred_family_id)} · {val(campaign, "title")}
                </h4>
                <StatusBadge status={val(r, "status")} />
                <p>
                  {t(
                    "Qualification checks the net paid amount against the first membership invoice. Discounts and credit approval do not count as payment.",
                  )}
                </p>
                {["submitted", "rejected"].includes(val(r, "status")) &&
                  r.submitted_by !== account.userId &&
                  can("engagement.review", campaign?.branch_id) && (
                    <ProductForm
                      title="Review referral qualification"
                      action="engagement.referral.review"
                      initial={{ id: r.id }}
                      fields={reviewFields}
                      onSaved={refresh}
                    />
                  )}{" "}
                {r.status === "approved" &&
                  can("engagement.grant", campaign?.branch_id) && (
                    <ProductForm
                      title="Grant referral reward"
                      action="engagement.reward.grant"
                      initial={{ source_kind: "referral", source_id: r.id }}
                      fields={reasonField}
                      onSaved={refresh}
                    />
                  )}
              </article>
            );
          })}
        </section>
      )}
      {configure && (
        <details className="portal-card">
          <summary>{t("Configure engagement rules")}</summary>
          <ProductForm
            title="Create non-cash reward rule"
            action="engagement.reward_rule.create"
            fields={[
              {
                name: "branch_id",
                label: "Branch",
                required: true,
                options: branchOptions,
              },
              { name: "code", label: "Stable rule code", required: true },
              { name: "title", label: "Reward title", required: true },
              {
                name: "description",
                label: "Transparent reward rules",
                required: true,
                type: "textarea",
              },
              {
                name: "source_kind",
                label: "Qualifying source",
                required: true,
                options: [
                  { value: "challenge", label: "Challenge" },
                  { value: "recognition", label: "Approved recognition" },
                  { value: "referral", label: "Qualified referral" },
                ],
              },
              {
                name: "unit",
                label: "Non-cash unit",
                required: true,
                options: [
                  { value: "badge", label: "Badge" },
                  { value: "star", label: "Star" },
                  { value: "point", label: "Point" },
                ],
              },
              {
                name: "quantity",
                label: "Quantity",
                required: true,
                type: "number",
                min: 1,
                max: 1000,
                step: "1",
              },
            ]}
            onSaved={refresh}
          />
          {rules.map((r) => (
            <article key={val(r, "id")}>
              <h4>
                {val(r, "title")} · {t("Version")} {val(r, "version")}
              </h4>
              <p>
                {val(r, "description")} · {val(r, "quantity")}{" "}
                {t(val(r, "unit"))}
              </p>
              {!r.published_at && can("engagement.configure", r.branch_id) && (
                <ProductForm
                  title="Publish reward rule"
                  action="engagement.reward_rule.publish"
                  initial={{ id: r.id }}
                  fields={[]}
                  onSaved={refresh}
                />
              )}
            </article>
          ))}
          <ChallengeCreator data={data} refresh={refresh} />
          <ReferralCampaignCreator data={data} refresh={refresh} />
        </details>
      )}
    </div>
  );
}
