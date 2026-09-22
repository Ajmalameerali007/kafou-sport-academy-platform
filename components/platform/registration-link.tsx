"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/platform/client";
import { useLocale } from "@/components/kafou/locale";
export function RegistrationLink({ leadId }: { leadId: string }) {
  const { t } = useLocale();
  const [links, setLinks] = useState<
    { id: string; status: string; expires_at: string }[]
  >([]);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const r = await api<typeof links>("registration-link", {
      action: "list",
      data: { lead_id: leadId },
    });
    if (r.ok) setLinks(r.data);
    else setMessage(r.message);
  }, [leadId]);
  useEffect(() => {
    let active = true;
    void api<typeof links>("registration-link", {
      action: "list",
      data: { lead_id: leadId },
    }).then((r) => {
      if (active) {
        if (r.ok) setLinks(r.data);
        else setMessage(r.message);
      }
    });
    return () => {
      active = false;
    };
  }, [leadId]);
  async function issue() {
    setBusy(true);
    setUrl("");
    const r = await api<{ token: string }>("registration-link", {
      action: "issue",
      data: { lead_id: leadId },
    });
    if (r.ok) {
      setUrl(`${window.location.origin}/register#${r.data.token}`);
      setMessage(
        t(
          "Copy this link now. It expires in 48 hours. No message has been sent.",
        ),
      );
      await load();
    } else setMessage(r.message);
    setBusy(false);
  }
  return (
    <section>
      <h3>{t("Parent registration link")}</h3>
      <button className="portal-link" disabled={busy} onClick={issue}>
        {t("Create registration link")}
      </button>
      {url && (
        <>
          <input aria-label={t("Registration link")} readOnly value={url} />
          <button
            className="portal-link"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setMessage(t("Copied"));
              } catch {
                setMessage(t("Select and copy the link."));
              }
            }}
          >
            {t("Copy link")}
          </button>
        </>
      )}
      <p role="status">{message}</p>
      <ul>
        {links.map((l) => (
          <li key={l.id}>
            {t(l.status)} · {new Date(l.expires_at).toLocaleString()}
            {l.status === "active" && (
              <button
                className="portal-link"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await api("registration-link", {
                    action: "revoke",
                    data: { lead_id: leadId, id: l.id },
                  });
                  if (!r.ok) setMessage(r.message);
                  await load();
                  setBusy(false);
                }}
              >
                {t("Revoke")}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
export function RegistrationContinuation() {
  const { t } = useLocale();
  const [children, setChildren] = useState<{ id: string; name: string }[]>([]);
  const [child, setChild] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const load = useCallback(async () => {
    const r = await api<typeof children>("children");
    if (r.ok) setChildren(r.data);
    else setMessage(r.message);
  }, []);
  useEffect(() => {
    let active = true;
    void api<typeof children>("children").then((r) => {
      if (active) {
        if (r.ok) setChildren(r.data);
        else setMessage(r.message);
      }
    });
    window.addEventListener("focus", load);
    return () => {
      active = false;
      window.removeEventListener("focus", load);
    };
  }, [load]);
  return (
    <main className="portal-panel">
      <h1>{t("Continue parent registration")}</h1>
      <p>
        {t(
          "Sign in and add your child to your family account, then return here to connect the enquiry.",
        )}
      </p>
      <a href="/parent" target="_blank" rel="noopener noreferrer">
        {t("Open family account")}
      </a>
      <button className="portal-link" onClick={load}>
        {t("Refresh")}
      </button>
      <label>
        {t("Child")}
        <select value={child} onChange={(e) => setChild(e.target.value)}>
          <option value="">{t("Choose child")}</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <p>
        {t(
          "This confirms that you want to link this enquiry to the selected child in your own family.",
        )}
      </p>
      <button
        className="portal-primary"
        disabled={!child || busy || done}
        onClick={async () => {
          setBusy(true);
          const r = await api("registration-link", {
            action: "continue",
            data: { token: window.location.hash.slice(1), child_id: child },
          });
          setBusy(false);
          if (r.ok) {
            setDone(true);
            setMessage(
              t(
                "Enquiry connected. Open your family account to choose an eligible trial.",
              ),
            );
            window.history.replaceState(null, "", "/register");
          } else setMessage(r.message);
        }}
      >
        {t("Confirm child and continue")}
      </button>
      <p role="status">{message}</p>
    </main>
  );
}
