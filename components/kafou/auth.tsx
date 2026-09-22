"use client";
import { useLocale } from "./locale";
import { useHydrated } from "@/lib/kafou/use-hydrated";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, ServiceNotice, focusFirstError } from "./fields";
import { authService, roleDestination } from "@/lib/kafou/services";
import { validateAuth, type FieldErrors } from "@/lib/kafou/validation";
const staff = [
  ["admin", "Admin"],
  ["branch", "Branch / Reception"],
  ["sales", "Sales"],
  ["coach", "Coach"],
];
type AuthView = "login" | "signup" | "forgot";
const authView = (value?: string | null): AuthView =>
  value === "signup" || value === "forgot" ? value : "login";
export function AuthExperience({
  initialView,
  initialStaff,
}: {
  initialView?: string;
  initialStaff?: string;
}) {
  const { t, dir } = useLocale();
  const [mode, setMode] = useState<AuthView>(authView(initialView));
  const [roleId, setRoleId] = useState(initialStaff);
  const role = staff.find(([id]) => id === roleId);
  const ready = useHydrated();
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const restore = () => {
      const query = new URLSearchParams(window.location.search);
      setMode(authView(query.get("view")));
      setRoleId(query.get("staff") || undefined);
      setErrors({});
      setNotice("");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  function change(view: string, staffId?: string) {
    setErrors({});
    setNotice("");
    setMode(authView(view));
    setRoleId(staffId);
    window.history.pushState(
      null,
      "",
      `/auth?view=${view}${staffId ? `&staff=${staffId}` : ""}`,
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(
      new FormData(event.currentTarget),
    ) as Record<string, string>;
    const found = validateAuth(mode, values);
    setErrors(found);
    setNotice("");
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const result = await authService.login({
          identifier: values.identifier.trim(),
          password: values.password,
          remember,
        });
        if (result.ok) {
          const destination = result.data.destination || roleDestination(result.data.role);
          if (destination) window.location.replace(destination);
          else
            setNotice("This account does not have a recognised access role.");
        } else setNotice(result.message);
      } else if (mode === "signup") {
        const result = await authService.signup({
          name: values.name.trim(),
          email: values.email.trim(),
          mobile: values.mobile.trim(),
          password: values.password,
          confirmPassword: values.confirmPassword,
        });
        setNotice(
          result.ok
            ? "Check your email to continue creating your account."
            : result.message,
        );
      } else {
        const result = await authService.forgotPassword(values.email.trim());
        setNotice(
          result.ok
            ? "If an account exists for this email, you will receive reset instructions."
            : result.message,
        );
      }
    } catch {
      setNotice(
        "We couldn’t reach the account service. Please try again later.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-experience">
      <p className="eyebrow form-eyebrow">
        {role ? `${t("STAFF ACCESS")} / ${t(role[1])}` : t("PARENT / STUDENT")}
      </p>
      <h1 className="form-title">
        {t(
          mode === "signup"
            ? "A STRONGER START."
            : mode === "forgot"
              ? "LET’S GET YOU BACK."
              : "WELCOME BACK.",
        )}
      </h1>
      <p className="form-intro">
        {t(
          mode === "signup"
            ? "Your family’s next chapter starts with you."
            : mode === "forgot"
              ? "Enter your account email to request reset instructions."
              : "Your family’s sporting journey, all in one place.",
        )}
      </p>
      {mode === "forgot" ? (
        <>
          <form key="forgot" noValidate onSubmit={submit}>
            <fieldset disabled={!ready || busy}>
              <Field
                id="email"
                label={t("Email address")}
                type="email"
                autoComplete="email"
                error={errors.email}
                placeholder={t("you@example.com")}
              />
              <button
                className="button button-dark form-submit"
                disabled={busy}
                type="submit"
              >
                {t(busy ? "Checking availability…" : "Send reset instructions")}
                <span aria-hidden="true">↗</span>
              </button>
            </fieldset>
          </form>
          <button
            type="button"
            className="plain-link"
            onClick={() => change("login", role?.[0])}
          >
            {t("← Back to log in")}
          </button>
        </>
      ) : (
        <Tabs
          dir={dir}
          value={mode}
          onValueChange={(view) => change(view)}
          className="auth-tabs"
        >
          <TabsList variant="line" aria-label={t("Account access")}>
            <TabsTrigger value="login">{t("Log in")}</TabsTrigger>
            <TabsTrigger value="signup">{t("Create account")}</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <form
              key={`login-${role?.[0] || "parent"}`}
              noValidate
              onSubmit={submit}
            >
              <fieldset disabled={!ready || busy}>
                <Field
                  id="identifier"
                  label={t("Email")}
                  autoComplete="username"
                  error={errors.identifier}
                  placeholder={t("Your email address")}
                />
                <Field
                  id="password"
                  label={t("Password")}
                  type="password"
                  autoComplete="current-password"
                  error={errors.password}
                  placeholder={t("Your password")}
                />
                <div className="form-options">
                  <label className="remember-label">
                    <Checkbox
                      id="remember"
                      checked={remember}
                      onCheckedChange={(v) => setRemember(v === true)}
                    />
                    {t("Remember me")}
                  </label>
                  <button
                    type="button"
                    className="plain-link"
                    onClick={() => change("forgot", role?.[0])}
                  >
                    {t("Forgot password?")}
                  </button>
                </div>
                <button
                  className="button button-dark form-submit"
                  disabled={busy}
                  type="submit"
                >
                  {t(busy ? "Checking availability…" : "Log in")}
                  <span aria-hidden="true">↗</span>
                </button>
              </fieldset>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form key="signup" noValidate onSubmit={submit}>
              <fieldset disabled={!ready || busy}>
                <Field
                  id="name"
                  label={t("Parent / Guardian name")}
                  autoComplete="name"
                  error={errors.name}
                  placeholder={t("Your full name")}
                />
                <Field
                  id="mobile"
                  label={t("Mobile number")}
                  type="tel"
                  autoComplete="tel"
                  error={errors.mobile}
                  placeholder="+971 50 123 4567"
                />
                <Field
                  id="email"
                  label={t("Email address")}
                  type="email"
                  autoComplete="email"
                  error={errors.email}
                  placeholder={t("you@example.com")}
                />
                <Field
                  id="password"
                  label={t("Password")}
                  type="password"
                  autoComplete="new-password"
                  error={errors.password}
                  hint={t("Use at least 12 characters.")}
                  placeholder={t("Create a strong password")}
                />
                <Field
                  id="confirmPassword"
                  label={t("Confirm password")}
                  type="password"
                  autoComplete="new-password"
                  error={errors.confirmPassword}
                  placeholder={t("Re-enter your password")}
                />
                <p className="form-smallprint">
                  {t(
                    "Family accounts are created by a parent or guardian. Staff accounts are provided by the academy.",
                  )}
                </p>
                <button
                  className="button button-dark form-submit"
                  disabled={busy}
                  type="submit"
                >
                  {t(busy ? "Checking availability…" : "Create account")}
                  <span aria-hidden="true">↗</span>
                </button>
              </fieldset>
            </form>
          </TabsContent>
        </Tabs>
      )}
      {notice && <ServiceNotice>{notice}</ServiceNotice>}
      <p className="availability-note">
        {t(
          "Staging accounts only. Use synthetic details; live family intake is not open.",
        )}
      </p>
      <div className="staff-access">
        <span className="eyebrow">{t("STAFF ACCESS")}</span>
        <div>
          {staff.map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={role?.[0] === id ? "selected" : ""}
              onClick={() => change("login", id)}
            >
              {t(label)}
              <span aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        {role && (
          <button
            type="button"
            className="plain-link"
            onClick={() => change("login")}
          >
            {t("Return to Parent / Student access")}
          </button>
        )}
      </div>
    </div>
  );
}
