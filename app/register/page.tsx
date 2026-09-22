import { RegistrationContinuation } from "@/components/platform/registration-link";
export const metadata = {
  title: "Continue registration | KAFOU",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default function RegistrationPage() {
  return <RegistrationContinuation />;
}
