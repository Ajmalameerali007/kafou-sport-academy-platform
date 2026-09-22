"use client";
import { LocaleProvider, type Locale } from "./locale";
import { FormShell } from "./form-shell";
import { AuthExperience } from "./auth";
export function AuthPage({
  locale,
  ...props
}: {
  locale: Locale;
  initialView?: string;
  initialStaff?: string;
}) {
  return (
    <LocaleProvider locale={locale}>
      <FormShell kind="auth">
        <AuthExperience {...props} />
      </FormShell>
    </LocaleProvider>
  );
}
