"use client";
/* Private data URLs are authorized per request and never stored in browser storage. */
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from "react";
import { api } from "@/lib/platform/client";
import { useLocale } from "@/components/kafou/locale";
import { usePortalQuery } from "./use-portal-query";
import type { DailyRow } from "@/lib/platform/daily-operations";
type Reference = { id: string; approved: boolean };
type StaffPhoto = { staff: string; name: string; synthetic: boolean; enabled: boolean; consent: boolean; can_approve: boolean; references: Reference[] };
const fileContent = (file: File) => new Promise<string>((resolve, reject) => {
  if (file.size > 8 * 1024 * 1024) return reject(Error("Use a photo smaller than 8 MB."));
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
  reader.onerror = () => reject(Error("Could not read this photo. Choose it again."));
  reader.readAsDataURL(file);
});
const announce = () => window.dispatchEvent(new CustomEvent("kafou:saved", { detail: { inlineFeedback: true } }));

export function StaffFaceCheckIn({ branch, shift, onSaved, disabled = false }: {
  branch: string; shift: DailyRow | null; onSaved: () => void; disabled?: boolean;
}) {
  const { t } = useLocale();
  const account = usePortalQuery<{ userId: string }>("auth/session");
  const staff = account.data?.userId || "";
  const q = usePortalQuery<StaffPhoto>(`staff-photo?staff=${staff}`, !!staff);
  const [file, setFile] = useState<File | null>(null), [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""), [consent, setConsent] = useState(false);
  const lock = useRef(false), pending = useRef({ fingerprint: "", key: crypto.randomUUID() });
  const info = q.data, reference = info?.references[0];
  if (!info?.synthetic || !info.enabled || q.denied) return null;
  const save = async (action: "consent" | "reference" | "process", granted?: boolean) => {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice("");
    try {
      let payload: Record<string, unknown> = { action, staff };
      if (action === "consent") payload.granted = granted;
      else {
        if (!file) throw Error("Choose a photo first.");
        payload.content = await fileContent(file);
        if (action === "process") {
          payload = { ...payload, reference: reference?.id, clock: shift ? { action: "shift.out", data: { id: shift.id } } : { action: "shift.in", data: { branch_id: branch || null } } };
          const fingerprint = JSON.stringify(payload);
          if (pending.current.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
          payload.key = pending.current.key;
        }
      }
      const result = await api<{ matched?: boolean }>("staff-photo", payload);
      if (!result.ok) throw Error(result.message);
      setNotice(t(action === "process" ? result.data.matched ? "Photo verified and time recorded" : "Photo did not match; no time was recorded" : "Saved"));
      setFile(null); q.refresh(); onSaved(); announce();
    } catch (error) { setNotice(t(error instanceof Error ? error.message : "Could not save. Please try again.")); }
    finally { lock.current = false; setBusy(false); }
  };
  return <details className="daily-face-checkin">
    <summary>{t("Staff photo and face check-in")}</summary>
    <p>{t("Local synthetic test only. Photo matching has no liveness detection; supervised manual clock-in remains available.")}</p>
    <p>{t("References are private, expire after 30 days and can be removed at any time. Use synthetic test photos only.")}</p>
    {!info.consent ? <>
      <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t("I consent to this local synthetic face-verification test.")}</label>
      <button className="portal-btn" disabled={busy || !consent || !!q.error} onClick={() => void save("consent", true)}>{t("Enable staff photo verification")}</button>
    </> : <>
      <p>{t(reference ? reference.approved ? "Photo approved" : "Photo awaiting approval" : "Add a clear photo with one face.")}</p>
      <label>{t(reference?.approved ? "New check-in photo" : "Add staff photo")}
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="user" disabled={busy} onChange={e => { setFile(e.target.files?.[0] || null); setNotice(""); e.target.value = ""; }} />
      </label>
      {file && <span>{file.name}</span>}
      <button className="portal-primary" disabled={busy || !file || !!q.error || (reference?.approved && disabled)} onClick={() => void save(reference?.approved ? "process" : "reference")}>
        {t(busy ? "Saving…" : reference?.approved ? shift ? "Verify and clock out" : "Verify and clock in" : "Save photo for approval")}
      </button>
      {!reference?.approved && <small>{t("Another branch manager or administrator must review and approve your photo.")}</small>}
      <button className="portal-link" disabled={busy} onClick={() => void save("consent", false)}>{t("Withdraw consent and remove photo")}</button>
    </>}
    {(notice || q.error) && <p role="status">{notice || t(q.error || "")}</p>}
  </details>;
}

export function StaffPhotoApproval({ staff, onSaved }: { staff: string; onSaved: () => void }) {
  const { t } = useLocale();
  const q = usePortalQuery<StaffPhoto>(`staff-photo?staff=${staff}`, !!staff);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<{ id: string; src: string } | null>(null);
  const pending = q.data?.references.find(reference => !reference.approved);
  const visible = preview?.id === pending?.id && !q.denied && !q.error;
  if (!q.data?.synthetic || !q.data.enabled || !q.data.can_approve || !pending) return null;
  return <section className="daily-face-checkin" aria-label={t("Photo approval")}>
    <strong>{t("Staff photo approval")}</strong>
    <p>{q.data.name} · {t("Confirm the correct synthetic staff reference before approving.")}</p>
    <button className="portal-btn" disabled={busy || !!q.error} onClick={async () => {
      setBusy(true);
      const result = await api<{content: string}>("staff-photo", {action:"preview", staff, reference:pending.id});
      setBusy(false);
      if (result.ok) setPreview({ id:pending.id, src:`data:image/jpeg;base64,${result.data.content}` });
      else setNotice(t(result.message));
    }}>{t("Review staff photo")}</button>
    {visible && preview && <img className="staff-photo-preview" src={preview.src} alt={t("Staff reference preview")} />}
    <button className="portal-primary" disabled={busy || !visible} onClick={async () => {
      setBusy(true); setNotice("");
      const result = await api("staff-photo", { action:"approve", staff, reference:pending.id });
      setBusy(false); setNotice(t(result.ok ? "Saved" : result.message));
      if (result.ok) { setPreview(null); q.refresh(); onSaved(); announce(); }
    }}>{t(busy ? "Saving…" : "Approve staff photo")}</button>
    {notice && <p role="status">{notice}</p>}
  </section>;
}
