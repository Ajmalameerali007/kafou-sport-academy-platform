import { expect } from "@playwright/test";
export async function emailLink(email: string) {
  let link = "";
  await expect
    .poll(async () => {
      const list = (await (
        await fetch("http://127.0.0.1:56324/api/v1/messages")
      ).json()) as {
        messages: Array<{ ID: string; To: Array<{ Address: string }> }>;
      };
      const m = list.messages.find((m: { To: Array<{ Address: string }> }) =>
        m.To.some((t) => t.Address === email),
      );
      if (!m) return false;
      const message = (await (
        await fetch(`http://127.0.0.1:56324/api/v1/message/${m.ID}`)
      ).json()) as { HTML: string };
      link =
        message.HTML.match(/href="([^"]+)"/)?.[1]?.replaceAll("&amp;", "&") ||
        "";
      return !!link;
    })
    .toBe(true);
  return link;
}
