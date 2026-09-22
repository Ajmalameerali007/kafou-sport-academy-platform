export function arrivalDecision(
  mark: string,
  arrival: { source: unknown } | null,
  editable: boolean,
) {
  return {
    canCheckIn: editable && !arrival && (mark === "" || mark === "present"),
    label: arrival
      ? arrival.source === "check_in"
        ? "Checked in"
        : "Attendance confirmed"
      : "Not checked in",
  };
}
