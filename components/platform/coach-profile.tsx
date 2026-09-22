"use client";
import { useState } from "react";
import { useLocale } from "@/components/kafou/locale";
import type { AccountContext } from "@/lib/platform/contracts";
import { productCommand } from "@/lib/platform/product";
import { records, value, type PortalData } from "@/lib/platform/portal-model";
import { announceSaved } from "./portal-ui";

const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function CoachProfilePanel({
  data,
  account,
  refresh,
}: {
  data: PortalData;
  account: AccountContext;
  refresh: () => void;
}) {
  const { t } = useLocale();
  const own = records(data, "profiles").find((p) => p.id === account.userId);
  const availability = records(data, "coach_availability").filter(
    (a) => a.coach_id === account.userId,
  );
  const [bio, setBio] = useState(String(own?.bio ?? ""));
  const [qualifications, setQualifications] = useState(
    Array.isArray(own?.qualifications)
      ? (own.qualifications as string[]).join(", ")
      : "",
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("16:00");
  const [end, setEnd] = useState("18:00");
  return (
    <section className="portal-panel">
      <div className="portal-panel-head">
        <h2>{t("My profile")}</h2>
      </div>
      <form
        className="ops-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setNotice("");
          const result = await productCommand("coach.profile.update", {
            bio,
            qualifications: qualifications
              .split(",")
              .map((q) => q.trim())
              .filter(Boolean),
          });
          setBusy(false);
          if (result.ok) {
            setNotice(t("Saved"));
            announceSaved(e.currentTarget);
            refresh();
          } else setNotice(t(result.message));
        }}
      >
        <label>
          {t("Bio")}
          <textarea
            value={bio}
            maxLength={2000}
            onChange={(e) => setBio(e.target.value)}
          />
        </label>
        <label>
          {t("Qualifications (comma separated)")}
          <input
            value={qualifications}
            onChange={(e) => setQualifications(e.target.value)}
          />
        </label>
        <button className="button button-dark" disabled={busy} type="submit">
          {busy ? t("Saving…") : t("Save profile")}
        </button>
        {notice && <p className="product-notice">{notice}</p>}
      </form>
      <h3>{t("Weekly availability")}</h3>
      {availability.length > 0 ? (
        <ul className="portal-availability-list">
          {availability
            .sort(
              (a, b) =>
                Number(a.weekday) - Number(b.weekday) ||
                value(a, "start_time").localeCompare(value(b, "start_time")),
            )
            .map((a) => (
              <li key={value(a, "id")}>
                {t(weekdayNames[Number(a.weekday)])} {value(a, "start_time")}–
                {value(a, "end_time")}
                <button
                  className="portal-link"
                  onClick={async () => {
                    const result = await productCommand(
                      "coach.availability.remove",
                      { id: a.id },
                    );
                    if (result.ok) refresh();
                  }}
                >
                  {t("Remove")}
                </button>
              </li>
            ))}
        </ul>
      ) : (
        <p>{t("No availability submitted yet.")}</p>
      )}
      <form
        className="ops-editor"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          const result = await productCommand("coach.availability.save", {
            weekday: Number(weekday),
            start_time: start,
            end_time: end,
          });
          setBusy(false);
          if (result.ok) {
            setNotice(t("Saved"));
            refresh();
          } else setNotice(t(result.message));
        }}
      >
        <div className="ops-form-grid">
          <label>
            {t("Day")}
            <select value={weekday} onChange={(e) => setWeekday(e.target.value)}>
              {weekdayNames.map((name, index) => (
                <option key={index} value={index}>
                  {t(name)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("From")}
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            {t("To")}
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
        </div>
        <button className="button button-dark" disabled={busy} type="submit">
          {t("Add availability window")}
        </button>
      </form>
    </section>
  );
}
