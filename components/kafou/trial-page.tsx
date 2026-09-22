"use client";
import { LocaleProvider, type Locale } from "./locale";
import { FormShell } from "./form-shell";
import { TrialWizard } from "./trial";
export function TrialPage({
  locale,
  ...props
}: {
  locale: Locale;
  initialSport?: string;
  initialBranch?: string;
}) {
  return (
    <LocaleProvider locale={locale}>
      <FormShell kind="trial">
        <TrialWizard {...props} />
      </FormShell>
    </LocaleProvider>
  );
}
