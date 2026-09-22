"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/platform/client";
import { useLocale } from "@/components/kafou/locale";
import { records, value, type PortalData } from "@/lib/platform/portal-model";
import type { AccountContext } from "@/lib/platform/contracts";
type Option = {
  id: string;
  child_name: string;
  class_name: string;
  scope: string;
  enabled: boolean;
  review_required: boolean;
};
export function CoachMessages({
  data,
  account,
  refresh,
}: {
  data: PortalData;
  account: AccountContext;
  refresh: () => Promise<void>;
}) {
  const { t } = useLocale();
  const draftForm = useRef<HTMLFormElement>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [selected, setSelected] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState("");
  const [receipts, setReceipts] = useState<
    { id: string; read_count: number }[]
  >([]);
  const load = useCallback(async () => {
    const r = await api<Option[]>("coach-conversations");
    if (r.ok) setOptions(r.data);
    else setMessage(r.message);
  }, []);
  useEffect(() => {
    let active = true;
    void api<Option[]>("coach-conversations").then((r) => {
      if (active) {
        if (r.ok) setOptions(r.data);
        else setMessage(r.message);
      }
    });
    return () => {
      active = false;
    };
  }, [data]);
  const option = options.find((o) => o.id === selected);
  const conv = records(data, "coach_conversations").find(
    (c) => c.enrollment_id === selected,
  );
  const messages = records(data, "coach_messages")
    .filter((m) => m.conversation_id === conv?.id)
    .sort((a, b) =>
      value(a, "created_at").localeCompare(value(b, "created_at")),
    );
  async function command(
    action: string,
    d: Record<string, unknown>,
    requestKey = crypto.randomUUID(),
  ) {
    setBusy(true);
    const r = await api("coach-conversations", {
      key: requestKey,
      command: { action, data: d },
    });
    if (!r.ok) setMessage(r.message);
    else {
      setMessage(t("Saved"));
      await refresh();
      await load();
    }
    setBusy(false);
    return r.ok;
  }
  const visibleIds = messages.map((m) => String(m.id)).join(",");
  useEffect(() => {
    if (!conv?.id) return;
    let active = true;
    void (async () => {
      await api("coach-conversations", {
        key: crypto.randomUUID(),
        command: {
          action: "read",
          data: {
            conversation_id: conv.id,
            message_ids: visibleIds ? visibleIds.split(",") : [],
          },
        },
      });
      const r = await api<{ id: string; read_count: number }[]>(
        `coach-conversations/receipts?conversation=${conv.id}`,
      );
      if (active && r.ok) setReceipts(r.data);
    })();
    return () => {
      active = false;
    };
  }, [conv?.id, visibleIds, data]);
  return (
    <section className="portal-panel">
      <h2>{t("Coach messages")}</h2>
      <p>
        {t(
          "Child conversations follow current enrollment and coach assignment. Operations reviews coach replies before publication when required by policy.",
        )}
      </p>
      {!options.length && (
        <p>
          {t(
            "Coach messaging is inactive or no eligible enrollment is available.",
          )}
        </p>
      )}
      <label>
        {t("Child and class")}
        <select
          value={selected}
          onChange={(e) => {
            if (body && !window.confirm(t("Discard unsaved changes?"))) return;
            document.dispatchEvent(
              new CustomEvent("kafou:saved", { detail: draftForm.current }),
            );
            setSelected(e.target.value);
            setBody("");
            setKey("");
            setMessage("");
          }}
        >
          <option value="">{t("Choose child")}</option>
          {options.map((o) => (
            <option value={o.id} key={o.id}>
              {o.child_name} · {o.class_name}
            </option>
          ))}
        </select>
      </label>
      {option && !conv && (
        <button
          disabled={busy || !option.enabled}
          onClick={() => command("open", { enrollment_id: selected })}
        >
          {t("Open conversation")}
        </button>
      )}
      {conv && (
        <>
          <ol>
            {messages.map((m) => (
              <li key={String(m.id)}>
                <p>{value(m, "body")}</p>
                <small>
                  {m.author_id === account.userId ? t("You") : t("Participant")}{" "}
                  · {t(value(m, "status"))} · {t("Read by participants")}:{" "}
                  {receipts.find((r) => r.id === m.id)?.read_count ?? "—"} ·{" "}
                  {new Date(value(m, "created_at")).toLocaleString()}
                </small>
                {m.status === "draft" &&
                  option?.scope === "oversight" &&
                  m.author_id !== account.userId && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        command("publish", {
                          conversation_id: conv.id,
                          id: m.id,
                        })
                      }
                    >
                      {t("Approve and publish")}
                    </button>
                  )}
              </li>
            ))}
          </ol>
          <form ref={draftForm} onSubmit={(e) => e.preventDefault()}>
            <label>
              {t("Message")}
              <textarea
                value={body}
                maxLength={2000}
                onChange={(e) => {
                  setBody(e.target.value);
                  setKey(crypto.randomUUID());
                }}
              />
            </label>
            <button
              disabled={busy || !option?.enabled || body.trim().length < 2}
              onClick={async () => {
                if (
                  await command(
                    "reply",
                    { conversation_id: conv.id, body },
                    key || crypto.randomUUID(),
                  )
                ) {
                  setBody("");
                  setKey("");
                  document.dispatchEvent(
                    new CustomEvent("kafou:saved", {
                      detail: draftForm.current,
                    }),
                  );
                }
              }}
            >
              {option?.scope === "coach" && option.review_required
                ? t("Send for review")
                : t("Send message")}
            </button>
          </form>
          <button
            disabled={busy || !option?.enabled}
            onClick={() => command("escalate", { conversation_id: conv.id })}
          >
            {conv.escalated_at
              ? t("Escalated to operations")
              : t("Escalate to operations")}
          </button>
        </>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
