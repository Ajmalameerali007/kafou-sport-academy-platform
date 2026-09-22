export type SportId = "swimming" | "football" | "karate" | "badminton";
export type Role =
  | "parent"
  | "student"
  | "coach"
  | "sales"
  | "branch"
  | "reception"
  | "admin"
  | "super_admin";
export type Experience = "beginner" | "some" | "training" | "unsure";
export type ServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      code:
        | "unavailable"
        | "validation"
        | "unauthorized"
        | "unauthenticated"
        | "forbidden"
        | "conflict"
        | "rate_limited"
        | "not_found";
      message: string;
    };
export interface Session {
  userId: string;
  role: Role;
  roles?: Role[];
  destination?: string;
}
export interface LoginInput {
  identifier: string;
  password: string;
  remember: boolean;
}
export interface SignupInput {
  name: string;
  mobile: string;
  email: string;
  password: string;
  confirmPassword: string;
}
export interface ConfirmedLocation {
  id: string;
  name: string;
  area: string;
  sports: SportId[];
}
export interface TrialDraft {
  parentName: string;
  mobile: string;
  email: string;
  childName: string;
  dob: string;
  age?: string;
  childId?: string;
  idempotencyKey?: string;
  preferredBranch?: string;
  sport: SportId | "";
  locationId: string | null;
  experience: Experience | "";
}
export interface AuthService {
  login(input: LoginInput): Promise<ServiceResult<Session>>;
  signup(
    input: SignupInput,
  ): Promise<ServiceResult<{ verificationRequired: boolean }>>;
  forgotPassword(email: string): Promise<ServiceResult<void>>;
  resetPassword(token: string, password: string): Promise<ServiceResult<void>>;
}
export interface LocationService {
  list(sport?: SportId): Promise<ConfirmedLocation[]>;
}
export interface TrialService {
  submit(
    draft: TrialDraft,
  ): Promise<
    ServiceResult<{
      requestId: string;
      reference?: string;
      status: "requested";
    }>
  >;
}
