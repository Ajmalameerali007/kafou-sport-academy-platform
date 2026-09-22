"use client";
import { useLayoutEffect, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { CampaignImage } from "./campaign-image";
import { useLocale } from "./locale";
import { useHydrated } from "@/lib/kafou/use-hydrated";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Field, ServiceNotice, focusFirstError } from "./fields";
import { sports } from "@/lib/kafou/content";
import { useBranchPreferences } from "@/lib/kafou/branches";
import { TrialBookingPanel } from "@/components/platform/operations";
import { api } from "@/lib/platform/client";
import { trialService } from "@/lib/kafou/services";
import {
  validateQuickTrialStep,
  type FieldErrors,
} from "@/lib/kafou/validation";
import type { TrialDraft } from "@/lib/kafou/types";
const steps = ["Choose", "Your family", "Review"];
const headings = [
  "Find their spark.",
  "Just the essentials.",
  "Ready for their first step.",
];
const intros = [
  "Pick a sport and the branch that suits you. Three simple steps.",
  "Four details to help us find the right starting point.",
  "Check your preferences. After saving, sign in to see eligible trial sessions.",
];
export function TrialWizard({
  initialSport,
  initialBranch,
}: {
  initialSport?: string;
  initialBranch?: string;
}) {
  const { t, dir } = useLocale();
  const { branches: branchPreferences, error: branchError } =
    useBranchPreferences();
  const requestKey = useRef<string>(crypto.randomUUID());
  const [reference, setReference] = useState("");
  const [enquiryId, setEnquiryId] = useState("");
  const [draft, setDraft] = useState<TrialDraft>({
    parentName: "",
    mobile: "",
    email: "",
    childName: "",
    dob: "",
    age: "",
    sport: sports.find((s) => s.id === initialSport)?.id || "",
    locationId: null,
    preferredBranch: initialBranch || "",
    experience: "unsure",
  });
  const [savedChildren, setSavedChildren] = useState<
    Array<{
      id: string;
      name: string;
      reported_age: number | null;
      dob: string | null;
    }>
  >([]);
  useEffect(() => {
    let live = true;
    void api<typeof savedChildren>("children").then((r) => {
      if (!live || !r.ok) return;
      setSavedChildren(r.data);
      const selected = r.data.find(
        (c) => c.id === new URLSearchParams(location.search).get("child"),
      );
      if (selected)
        setDraft((d) => ({
          ...d,
          childId: selected.id,
          childName: selected.name,
          age: String(selected.reported_age || ""),
        }));
    });
    return () => {
      live = false;
    };
  }, []);
  const ready = useHydrated();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) heading.current?.focus();
    else mounted.current = true;
  }, [step]);
  useLayoutEffect(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(panel.current, {
        y: 12,
        opacity: 0,
        duration: 0.32,
        ease: "power2.out",
      });
    });
    return () => mm.revert();
  }, [step]);
  function update(key: keyof TrialDraft, value: string) {
    requestKey.current = crypto.randomUUID();
    setReference("");
    setDraft((d) => ({ ...d, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
    setNotice("");
  }
  function move(to: number) {
    setErrors({});
    setNotice("");
    setStep(to);
  }
  async function next(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const found = validateQuickTrialStep(step, { ...draft });
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }
    if (step < 2) {
      move(step + 1);
      return;
    }
    for (let i = 0; i < 2; i++) {
      const e = validateQuickTrialStep(i, { ...draft });
      if (Object.keys(e).length) {
        setStep(i);
        setErrors(e);
        focusFirstError(e);
        return;
      }
    }
    setBusy(true);
    try {
      const result = await trialService.submit({
        ...draft,
        idempotencyKey: requestKey.current,
        parentName: draft.parentName.trim(),
        mobile: draft.mobile.trim(),
        childName: draft.childName.trim(),
        email: draft.email.trim(),
      });
      if (result.ok) {
        setReference(result.data.reference || result.data.requestId);
        setEnquiryId(result.data.requestId);
      }
      setNotice(
        result.ok
          ? "Enquiry saved. Choose an eligible session below to book your trial."
          : result.message,
      );
    } catch {
      setNotice(
        "We couldn’t reach the trial service. No booking has been confirmed. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="trial-wizard">
      {branchError && <ServiceNotice>{branchError}</ServiceNotice>}
      {savedChildren.length > 0 && step === 1 && (
        <div className="field">
          <label htmlFor="saved-child">
            {t("Choose a child from your family")}
          </label>
          <select
            id="saved-child"
            value={draft.childId || ""}
            onChange={(e) => {
              const c = savedChildren.find((c) => c.id === e.target.value);
              requestKey.current = crypto.randomUUID();
              setDraft((d) => ({
                ...d,
                childId: c?.id,
                childName: c?.name || "",
                age: String(c?.reported_age || ""),
              }));
            }}
          >
            <option value="">{t("Enter another child")}</option>
            {savedChildren.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {enquiryId && <TrialBookingPanel enquiryId={enquiryId} />}
      {reference && (
        <ServiceNotice>{`${t("Enquiry received")} · ${reference}`}</ServiceNotice>
      )}
      <div className="trial-progress-label">
        <span className="eyebrow">{t("A first step. A big possibility.")}</span>
        <span dir="ltr">0{step + 1} / 03</span>
      </div>
      <Progress
        value={((step + 1) / 3) * 100}
        aria-label={`${t("Step")} ${step + 1} / 3: ${t(steps[step])}`}
        className="trial-progress"
      />
      <ol className="trial-step-list">
        {steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={i <= step ? "visited" : ""}
          >
            {i < step ? (
              <button type="button" onClick={() => move(i)}>
                {t(label)}
              </button>
            ) : (
              <span>{t(label)}</span>
            )}
          </li>
        ))}
      </ol>
      <div ref={panel}>
        <h1 ref={heading} tabIndex={-1} className="form-title trial-title">
          {t(headings[step])}
        </h1>
        <p className="form-intro">{t(intros[step])}</p>
        <form noValidate onSubmit={next}>
          <fieldset disabled={!ready || busy}>
            {step === 0 && (
              <>
                <RadioGroup
                  dir={dir}
                  id="sport"
                  tabIndex={-1}
                  value={draft.sport}
                  onValueChange={(v) => update("sport", v)}
                  aria-label={t("Choose a sport")}
                  aria-invalid={!!errors.sport}
                  aria-describedby={errors.sport ? "sport-error" : undefined}
                  className="sport-choices compact-sport-choices"
                >
                  {sports.map((s) => (
                    <label
                      key={s.id}
                      className={`sport-choice ${draft.sport === s.id ? "selected" : ""}`}
                    >
                      <CampaignImage asset={s.id} sizes="240px" decorative />
                      <span>
                        <RadioGroupItem value={s.id} id={`choice-${s.id}`} />
                        {t(s.name)}
                      </span>
                    </label>
                  ))}
                </RadioGroup>
                {errors.sport && (
                  <p id="sport-error" className="field-error" role="alert">
                    {t(errors.sport)}
                  </p>
                )}
                <div className="field">
                  <label htmlFor="preferredBranch">
                    {t("Preferred branch (optional)")}
                  </label>
                  <select
                    id="preferredBranch"
                    value={draft.preferredBranch}
                    onChange={(e) => update("preferredBranch", e.target.value)}
                    aria-describedby="branch-hint"
                    aria-invalid={!!errors.preferredBranch}
                  >
                    <option value="">{t("Help me choose")}</option>
                    {branchPreferences.map((b) => (
                      <option key={b.id} value={b.slug}>
                        {dir === "rtl" && b.name_ar ? b.name_ar : t(b.name)}
                      </option>
                    ))}
                  </select>
                  <p id="branch-hint" className="field-hint">
                    {t(
                      "Provisional branch names. Venue details and class times are being confirmed.",
                    )}
                  </p>
                </div>
                <div className="booking-availability">
                  <span className="status-dot" />
                  <div>
                    <strong>{t("Upcoming classes")}</strong>
                    <p>
                      {t(
                        "Timetable coming soon. No trial time is reserved yet.",
                      )}
                    </p>
                  </div>
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <div className="trial-fields-grid">
                  <Field
                    id="parentName"
                    label="Parent / Guardian name"
                    autoComplete="name"
                    placeholder="Your full name"
                    value={draft.parentName}
                    onChange={(e) => update("parentName", e.target.value)}
                    error={errors.parentName}
                  />
                  <Field
                    id="mobile"
                    label="Mobile number"
                    type="tel"
                    dir="ltr"
                    autoComplete="tel"
                    placeholder="+971 50 123 4567"
                    value={draft.mobile}
                    onChange={(e) => update("mobile", e.target.value)}
                    error={errors.mobile}
                  />
                  <Field
                    id="childName"
                    label="Child’s name"
                    autoComplete="off"
                    placeholder="Their first name"
                    value={draft.childName}
                    onChange={(e) => update("childName", e.target.value)}
                    error={errors.childName}
                  />
                  <Field
                    id="age"
                    label="Child’s age"
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="Age in years"
                    value={draft.age}
                    onChange={(e) =>
                      update(
                        "age",
                        e.target.value.replace(/[٠-٩]/g, (c) =>
                          String(c.charCodeAt(0) - 1632),
                        ),
                      )
                    }
                    error={errors.age}
                  />
                </div>
                <details
                  className="optional-details"
                  open={errors.email ? true : undefined}
                >
                  <summary>{t("Add email or experience (optional)")}</summary>
                  <Field
                    id="email"
                    label="Email address (optional)"
                    type="email"
                    autoComplete="email"
                    value={draft.email}
                    onChange={(e) => update("email", e.target.value)}
                    error={errors.email}
                  />
                  <div className="field">
                    <label htmlFor="experience">{t("Experience level")}</label>
                    <select
                      id="experience"
                      value={draft.experience}
                      onChange={(e) => update("experience", e.target.value)}
                    >
                      {[
                        ["unsure", "Not sure yet"],
                        ["beginner", "Just getting started"],
                        ["some", "Some experience"],
                        ["training", "Currently training"],
                      ].map(([id, label]) => (
                        <option key={id} value={id}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </details>
                <p className="form-smallprint">
                  {t(
                    "Please enter these details as the child’s parent or guardian.",
                  )}
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <div className="trial-review-heading">
                  <CampaignImage
                    asset={draft.sport || "football"}
                    sizes="160px"
                    decorative
                  />
                  <div>
                    <span className="eyebrow">
                      {t("Your free trial preference")}
                    </span>
                    <h2>
                      {t(sports.find((s) => s.id === draft.sport)?.name || "")}
                    </h2>
                    <p>
                      {t(
                        branchPreferences.find(
                          (b) => b.slug === draft.preferredBranch,
                        )?.name || "Help me choose",
                      )}
                    </p>
                  </div>
                </div>
                <div className="trial-summary">
                  {[
                    [
                      "Sport & branch",
                      `${t(sports.find((s) => s.id === draft.sport)?.name || "")} · ${t(branchPreferences.find((b) => b.slug === draft.preferredBranch)?.name || "Help me choose")}`,
                      0,
                    ],
                    [
                      "Young athlete",
                      `${draft.childName} · ${draft.age} ${t("years")}`,
                      1,
                    ],
                    [
                      "Parent / Guardian",
                      `${draft.parentName}\n${draft.mobile}${draft.email ? `\n${draft.email}` : ""}`,
                      1,
                    ],
                  ].map(([label, value, index]) => (
                    <div key={label}>
                      <span>{t(String(label))}</span>
                      <p dir="auto">{value}</p>
                      <button
                        type="button"
                        onClick={() => move(Number(index))}
                        aria-label={`${t("Edit")} ${t(String(label))}`}
                      >
                        {t("Edit")}
                      </button>
                    </div>
                  ))}
                </div>
                <ServiceNotice>
                  Online scheduling is being prepared. Trial dates and times are
                  not available yet.
                </ServiceNotice>
              </>
            )}
            <div className="trial-actions">
              {step > 0 && (
                <button
                  type="button"
                  className="button button-back"
                  onClick={() => move(step - 1)}
                >
                  {t("← Back")}
                </button>
              )}
              <button
                className="button button-dark"
                type="submit"
                disabled={busy}
              >
                {t(
                  busy
                    ? "Checking availability…"
                    : step === 2
                      ? "Send trial enquiry"
                      : step === 1
                        ? "Review preferences"
                        : "Continue",
                )}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </fieldset>
        </form>
      </div>
      {notice && <ServiceNotice>{notice}</ServiceNotice>}
      <p className="availability-note">
        {t(
          "Staging only. Use synthetic details. Submitting saves an enquiry, not a booking.",
        )}
      </p>
    </div>
  );
}
