import type { ConfirmedLocation } from "./types";
export type FieldErrors = Record<string, string>;
const emailValid = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const mobileValid = (v: string) =>
  /^\+?[\d\s()-]+$/.test(v) &&
  v.replace(/\D/g, "").length >= 9 &&
  v.replace(/\D/g, "").length <= 15;
const nameValid = (v: string) => v.trim().length >= 2 && v.trim().length <= 100;
export function validateAuth(
  mode: "login" | "signup" | "forgot",
  values: Record<string, string>,
): FieldErrors {
  const e: FieldErrors = {};
  const v = (k: string) => values[k] || "";
  if (mode === "login") {
    if (
      !emailValid(v("identifier").trim())
    )
      e.identifier = "Enter a valid email address.";
    if (!v("password")) e.password = "Enter your password.";
    return e;
  }
  if (!emailValid(v("email").trim())) e.email = "Enter a valid email address.";
  if (mode === "signup") {
    if (!nameValid(v("name"))) e.name = "Enter your name (2–100 characters).";
    if (!mobileValid(v("mobile")))
      e.mobile = "Enter a valid mobile number, including your country code.";
    if (v("password").length < 12) e.password = "Use at least 12 characters.";
    if (v("password") !== v("confirmPassword"))
      e.confirmPassword = "Your passwords do not match.";
  }
  return e;
}
export function validateTrialStep(
  step: number,
  values: Record<string, unknown>,
  locations: ConfirmedLocation[] = [],
): FieldErrors {
  const e: FieldErrors = {};
  const v = (k: string) => String(values[k] || "");
  if (step === 0) {
    if (!nameValid(v("parentName")))
      e.parentName = "Enter your name (2–100 characters).";
    if (!emailValid(v("email").trim()))
      e.email = "Enter a valid email address.";
    if (!mobileValid(v("mobile")))
      e.mobile = "Enter a valid mobile number, including your country code.";
  }
  if (step === 1) {
    if (!nameValid(v("childName")))
      e.childName = "Enter your child’s name (2–100 characters).";
    const date = new Date(v("dob") + "T12:00:00");
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(v("dob")) ||
      !Number.isFinite(date.getTime()) ||
      date > new Date() ||
      date.getFullYear() < 1900 ||
      date.toISOString().slice(0, 10) !== v("dob")
    )
      e.dob = "Enter a valid date of birth that is not in the future.";
  }
  if (
    step === 2 &&
    !["swimming", "football", "karate", "badminton"].includes(v("sport"))
  )
    e.sport = "Choose one of the four sports.";
  if (
    step === 3 &&
    values.locationId &&
    !locations.some(
      (l) =>
        l.id === values.locationId &&
        (!v("sport") || l.sports.includes(v("sport") as never)),
    )
  )
    e.locationId = "Choose an available location.";
  if (step === 3 && locations.length && !values.locationId)
    e.locationId = "Choose a location.";
  if (
    step === 4 &&
    !["beginner", "some", "training", "unsure"].includes(v("experience"))
  )
    e.experience = "Choose the closest experience level.";
  return e;
}

/** Short enquiry: preference, essential contact/child details, then review. */
export function validateQuickTrialStep(
  step: number,
  values: Record<string, unknown>,
): FieldErrors {
  const e: FieldErrors = {};
  const v = (k: string) => String(values[k] || "");
  if (step === 0) {
    if (!["swimming", "football", "karate", "badminton"].includes(v("sport")))
      e.sport = "Choose one of the four sports.";
    if (v("preferredBranch") && !/^[a-z0-9-]{1,80}$/.test(v("preferredBranch")))
      e.preferredBranch = "Choose a branch preference.";
  }
  if (step === 1) {
    if (!nameValid(v("parentName")))
      e.parentName = "Enter your name (2–100 characters).";
    if (!mobileValid(v("mobile")))
      e.mobile = "Enter a valid mobile number, including your country code.";
    if (v("email").trim() && !emailValid(v("email").trim()))
      e.email = "Enter a valid email address.";
    if (!nameValid(v("childName")))
      e.childName = "Enter your child’s name (2–100 characters).";
    if (
      !/^\d{1,2}$/.test(v("age")) ||
      Number(v("age")) < 1 ||
      Number(v("age")) > 17
    )
      e.age = "Enter your child’s age (1–17 years).";
  }
  return e;
}
