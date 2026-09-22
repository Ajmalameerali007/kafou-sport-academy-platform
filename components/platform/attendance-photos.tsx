"use client";
/* Private local object/data URLs must bypass remote image optimization. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { api } from "@/lib/platform/client";
import { useLocale } from "@/components/kafou/locale";
import { usePortalQuery } from "./use-portal-query";
const content = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
type Item = {
  id: string;
  file: File;
  url: string;
  state: "ready" | "processing" | "done" | "failed";
  message?: string;
};
export function AttendancePhotos({
  session,
  disabled,
  onSaved,
  onProcessing,
}: {
  session: string;
  disabled: boolean;
  onSaved: (revision: number) => void;
  onProcessing: (busy: boolean) => void;
}) {
  const { t } = useLocale();
  const [items, setItems] = useState<Item[]>([]),
    [camera, setCamera] = useState(false),
    [error, setError] = useState("");
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    facing = useRef("environment"),
    urls = useRef(new Set<string>()),
    busy = useRef(false),
    alive = useRef(true),
    cameraEpoch = useRef(0);
  const stop = () => {
    cameraEpoch.current++;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCamera(false);
  };
  useEffect(() => {
    alive.current = true;
    const objectUrls = urls.current;
    return () => {
      alive.current = false;
      onProcessing(false);
      // Invalidate pending permission requests on unmount.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      cameraEpoch.current++;
      stream.current?.getTracks().forEach((track) => track.stop());
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [onProcessing]);
  const add = (files: File[]) => {
    setError("");
    if (
      files.some((f) => f.size > 8 * 1024 * 1024) ||
      items.length + files.length > 10
    ) {
      setError(t("Use up to 10 photographs, each smaller than 8 MB."));
      return;
    }
    setItems((old) => [
      ...old,
      ...files.map((file) => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { id: crypto.randomUUID(), file, url, state: "ready" as const };
      }),
    ]);
  };
  const openCamera = async () => {
    stop();
    const epoch = cameraEpoch.current;
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError(t("Camera unavailable. Use Upload photos instead."));
      return;
    }
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing.current } },
        audio: false,
      });
      if (!alive.current || cameraEpoch.current !== epoch) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = next;
      setCamera(true);
      requestAnimationFrame(() => {
        if (video.current) {
          video.current.srcObject = next;
          void video.current.play();
        }
      });
    } catch {
      setError(t("Camera unavailable. Use Upload photos instead."));
    }
  };
  const process = async () => {
    if (busy.current || disabled) return;
    busy.current = true;
    onProcessing(true);
    for (const item of items.filter(
      (x) => x.state === "ready" || x.state === "failed",
    )) {
      if (!alive.current) break;
      setItems((old) =>
        old.map((x) =>
          x.id === item.id
            ? { ...x, state: "processing", message: undefined }
            : x,
        ),
      );
      try {
        const current = await api<{ revision: number; roster_token: string }>(
          `attendance/register?session=${session}`,
        );
        if (!current.ok) throw Error(current.message);
        const result = await api<{
          matched: number;
          exceptions: string[];
          recognized: number;
          revision: number;
          duplicate: boolean;
          cross_session_reuse: boolean;
        }>("attendance/photos", {
          action: "process",
          session,
          ...(current.data && {
            revision: current.data.revision,
            roster_token: current.data.roster_token,
          }),
          content: await content(item.file),
        });
        if (!result.ok) throw Error(result.message);
        if (!alive.current) break;
        const r = result.data;
        const message = r.duplicate
          ? t("Already processed — no duplicate marks.")
          : `${r.recognized} ${t("Matched")} · ${r.matched} ${t("Newly marked")} · ${r.exceptions.length} ${t("Need attention")}${r.cross_session_reuse ? " · " + t("This photo was used in another session. Verify when it was taken.") : ""}`;
        setItems((old) =>
          old.map((x) =>
            x.id === item.id ? { ...x, state: "done", message } : x,
          ),
        );
        onSaved(r.revision);
        window.dispatchEvent(
          new CustomEvent("kafou:saved", { detail: { inlineFeedback: true } }),
        );
      } catch (e) {
        if (alive.current)
          setItems((old) =>
            old.map((x) =>
              x.id === item.id
                ? {
                    ...x,
                    state: "failed",
                    message:
                      e instanceof Error
                        ? e.message
                        : t(
                            "Photo processing failed. Retry this photo or mark manually.",
                          ),
                  }
                : x,
            ),
          );
      }
    }
    busy.current = false;
    if (alive.current) onProcessing(false);
  };
  return (
    <section className="attendance-photos" aria-label={t("Photo assistance")}>
      <div className="attendance-toolbar">
        <button
          type="button"
          className="portal-btn"
          onClick={() => void openCamera()}
          disabled={disabled}
        >
          <Camera size={18} />
          {t("Take photo")}
        </button>
        <label className="portal-btn">
          <Upload size={18} />
          {t("Upload photos")}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            multiple
            disabled={disabled}
            onChange={(e) => {
              add(Array.from(e.target.files || []));
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <small>
        {t(
          "Photo matching is restricted to approved synthetic references in this local rehearsal.",
        )}
      </small>
      <small>{t("Photo results never mark a student absent.")}</small>
      {error && <p role="alert">{error}</p>}
      {camera && (
        <div className="attendance-camera">
          <video
            ref={video}
            playsInline
            muted
            aria-label={t("Camera preview")}
          />
          <div className="attendance-toolbar">
            <button
              type="button"
              className="portal-primary"
              onClick={() => {
                const v = video.current;
                if (!v || !v.videoWidth) return;
                const canvas = document.createElement("canvas");
                canvas.width = v.videoWidth;
                canvas.height = v.videoHeight;
                canvas.getContext("2d")?.drawImage(v, 0, 0);
                canvas.toBlob(
                  (blob) => {
                    if (blob && alive.current)
                      add([
                        new File([blob], `capture-${Date.now()}.jpg`, {
                          type: "image/jpeg",
                        }),
                      ]);
                  },
                  "image/jpeg",
                  0.9,
                );
              }}
            >
              {t("Capture")}
            </button>
            <button
              type="button"
              className="portal-btn"
              onClick={() => {
                facing.current =
                  facing.current === "environment" ? "user" : "environment";
                void openCamera();
              }}
            >
              {t("Switch camera")}
            </button>
            <button type="button" className="portal-btn" onClick={stop}>
              {t("Stop camera")}
            </button>
          </div>
        </div>
      )}
      {!!items.length && (
        <>
          <div className="attendance-photo-grid">
            {items.map((item) => (
              <article key={item.id}>
                {/* Private object URL is never persisted or exposed to other portals. */}
                <img src={item.url} alt={t("Photo preview")} />
                <button
                  type="button"
                  aria-label={t("Remove photo")}
                  disabled={item.state === "processing"}
                  onClick={() => {
                    URL.revokeObjectURL(item.url);
                    urls.current.delete(item.url);
                    setItems((old) => old.filter((x) => x.id !== item.id));
                  }}
                >
                  <X size={18} />
                </button>
                <p role="status">
                  {item.state === "processing"
                    ? t("Processing…")
                    : t(item.message || "Ready to process")}
                </p>
              </article>
            ))}
          </div>
          <button
            type="button"
            className="portal-btn"
            disabled={
              disabled ||
              items.some((x) => x.state === "processing") ||
              items.every((x) => x.state === "done")
            }
            onClick={() => void process()}
          >
            {t(
              items.some((x) => x.state === "failed")
                ? "Retry failed photos"
                : "Process photos",
            )}
          </button>
        </>
      )}
    </section>
  );
}
type ReferenceInfo = {
  name: string;
  synthetic: boolean;
  guardian: boolean;
  consent: boolean;
  version: number;
  references: { id: string; approved: boolean }[];
};
export function AttendanceReference({ child }: { child: string }) {
  const { t } = useLocale();
  const q = usePortalQuery<ReferenceInfo>(
    `attendance/reference?child=${child}`,
  );
  const [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{ id: string; src: string } | null>(null);
  const d = q.data;
  if (!d) return <p role="status">{t(q.error || "Loading reference…")}</p>;
  const action = async (payload: object) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    const r = await api<ReferenceInfo>("attendance/photos", {
      child,
      ...payload,
    });
    setBusy(false);
    setNotice(t(r.ok ? "Saved" : r.message));
    q.refresh();
  };
  return (
    <section className="attendance-reference">
      <h3>
        {t("Attendance photo reference")} · {d.name}
      </h3>
      <p>
        {t(
          "Optional attendance-photo consent is separate from marketing permission. Manual attendance remains available.",
        )}
      </p>
      {!d.synthetic ? (
        <p>
          {t(
            "Real-child recognition is not activated. Consent approval and representative validation are required.",
          )}
        </p>
      ) : (
        <>
          {d.guardian && (
            <>
              <label>
                <input
                  type="checkbox"
                  checked={d.consent}
                  disabled={busy}
                  onChange={(e) =>
                    void action({
                      action: "consent",
                      granted: e.target.checked,
                    })
                  }
                />
                {t(
                  "I consent to this synthetic child's photographs being used for this local attendance-matching rehearsal.",
                )}
              </label>
              {d.consent && (
                <label className="portal-btn">
                  {t(
                    "Choose reference photo — I confirm this is the correct subject",
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f)
                        await action({
                          action: "reference",
                          content: await content(f),
                        });
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </>
          )}
          {!d.consent && <p>{t("Consent unavailable")}</p>}
          {d.references.map((ref) => (
            <div key={ref.id}>
              <p>
                {t(
                  ref.approved
                    ? "Reference approved"
                    : "Awaiting staff reference confirmation",
                )}
              </p>
              <button
                type="button"
                className="portal-btn"
                disabled={busy}
                onClick={async () => {
                  const r = await api<{ content: string }>(
                    "attendance/photos",
                    { action: "preview", child, reference: ref.id },
                  );
                  if (r.ok)
                    setPreview({
                      id: ref.id,
                      src: `data:image/jpeg;base64,${r.data.content}`,
                    });
                  else setNotice(r.message);
                }}
              >
                {t("Review reference photo")}
              </button>
              {preview?.id === ref.id && (
                <>
                  <img
                    className="attendance-reference-preview"
                    src={preview.src}
                    alt={t("Reference photo")}
                  />
                  {!d.guardian && !ref.approved && (
                    <button
                      type="button"
                      className="portal-primary"
                      disabled={busy}
                      onClick={() =>
                        void action({ action: "approve", reference: ref.id })
                      }
                    >
                      {t("Confirm this reference belongs to this student")}
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
