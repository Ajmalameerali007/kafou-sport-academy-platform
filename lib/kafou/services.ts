import type { AuthService, LocationService, TrialService, Role } from "./types";
import { api } from "@/lib/platform/client";
export const authService: AuthService = {
  login: (input) => api("auth/login", input),
  signup: (input) => api("auth/signup", input),
  forgotPassword: (email) => api("auth/forgot", { email }),
  resetPassword: (_token, password) =>
    api("auth/reset", { password, confirmPassword: password }),
};
export const locationService: LocationService = {
  async list(sport) {
    const result =
      await api<
        Array<{
          id: string;
          name: string;
          area: string;
          sports: import("./types").SportId[];
        }>
      >("locations");
    return result.ok
      ? result.data.filter((v) => !sport || v.sports.includes(sport))
      : [];
  },
};
export const trialService: TrialService = {
  submit: (draft) =>
    api("enquiries", draft, {
      "Idempotency-Key": draft.idempotencyKey || crypto.randomUUID(),
    }),
};
const destinations: Record<Role, string> = {
  parent: "/parent",
  student: "/parent",
  coach: "/coach",
  sales: "/sales",
  branch: "/branch",
  reception: "/branch",
  admin: "/admin",
  super_admin: "/admin",
};
export function roleDestination(role: string): string | null {
  return Object.hasOwn(destinations, role) ? destinations[role as Role] : null;
}
