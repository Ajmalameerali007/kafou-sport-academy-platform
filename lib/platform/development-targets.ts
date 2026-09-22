import type { ProductData, ProductRow } from "./product";

/** Client choices mirror server invariants; SQL revalidates authorization and evidence. */
export function targetCompletionResults(
  target: ProductRow,
  data: ProductData,
): ProductRow[] {
  const baseline = data.development_results?.find(
    (row) => row.id === target.baseline_result_id,
  );
  if (!baseline || !target.published_at) return [];
  return (data.development_results ?? []).filter((result) => {
    const assessment = data.development_assessments?.find(
      (row) => row.id === result.assessment_id,
    );
    return (
      result.child_id === target.child_id &&
      result.criteria_id === target.criteria_id &&
      result.metric_key === target.metric_key &&
      result.unit === target.unit &&
      result.direction === target.direction &&
      new Date(String(result.measured_at)).getTime() >
        new Date(String(baseline.measured_at)).getTime() &&
      assessment?.status === "published" &&
      new Date(String(assessment.published_at)).getTime() >=
        new Date(String(target.published_at)).getTime() &&
      (target.direction === "lower"
        ? Number(result.value) <= Number(target.target_value)
        : Number(result.value) >= Number(target.target_value))
    );
  });
}

export function targetBaselineChoices(
  data: ProductData,
): Array<{ result: ProductRow; session: ProductRow }> {
  const sessions = (data.development_sessions ?? []).filter(
    (session) => session.can_coach === true && session.status !== "cancelled",
  );
  return (data.development_results ?? []).flatMap((result) => {
    if (
      !data.development_assessments?.some(
        (row) => row.id === result.assessment_id && row.status === "published",
      )
    )
      return [];
    const session = sessions.find(
      (row) =>
        row.sport === result.sport &&
        Array.isArray(row.students) &&
        row.students.some((child) => child.id === result.child_id),
    );
    return session ? [{ result, session }] : [];
  });
}
