import type { ProductData } from "./product";

/** UI choices only: the command still rechecks the current assignment and child/branch relationship. */
export function recognitionChildren(
  data: ProductData,
  includeStaffRecords: boolean,
) {
  const children = new Map<string, { id: string; name: string }>();
  if (includeStaffRecords) {
    for (const child of data.children ?? []) {
      if (typeof child.id === "string" && typeof child.name === "string")
        children.set(child.id, { id: child.id, name: child.name });
    }
  }
  for (const session of data.development_sessions ?? []) {
    if (
      session.can_coach !== true ||
      session.status === "cancelled" ||
      !Array.isArray(session.students)
    )
      continue;
    for (const child of session.students) {
      if (
        child &&
        typeof child.id === "string" &&
        typeof child.name === "string"
      )
        children.set(child.id, { id: child.id, name: child.name });
    }
  }
  return [...children.values()];
}
