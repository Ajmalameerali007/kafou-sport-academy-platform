/** Never accept a database demo exemption against hosted Auth or an HTTPS app. */
export function isLocalDemoRuntime(
  databaseUrl: string | undefined,
  appUrl: string | undefined,
) {
  if (databaseUrl !== "http://127.0.0.1:56321" || !appUrl) return false;
  try {
    const app = new URL(appUrl);
    return (
      app.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(app.hostname)
    );
  } catch {
    return false;
  }
}
