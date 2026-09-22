import type { ServiceResult } from "@/lib/kafou/types";
export async function api<T>(
  path: string,
  data?: unknown,
  headers?: Record<string, string>,
): Promise<ServiceResult<T>> {
  try {
    const res = await fetch(`/api/${path}`, {
      method: data === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...headers },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    return await res.json();
  } catch {
    return {
      ok: false,
      code: "unavailable",
      message: "The service could not complete this request. Please try again.",
    };
  }
}
export const familyService = {
  command: (action: string, data: unknown) =>
    api<{ id: string }>("commands", { action, data }),
};
export const enquiryService = { command: familyService.command };
export const staffService = {
  command: familyService.command,
  invite: (data: unknown) => api<{ id: string }>("staff/invite", data),
};

export const operationsService = {
  command: (action: string, data: unknown) =>
    api<{ id: string; reference?: string; token?: string; created?: number }>(
      "operations",
      { action, data },
    ),
  availability: (enquiry: string) =>
    api<import("./operations").AvailableSession[]>(
      `availability?enquiry=${encodeURIComponent(enquiry)}`,
    ),
};
