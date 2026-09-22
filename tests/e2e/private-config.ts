/** Test runner only. Provisioned credentials are injected from private configuration. */
export const demoPassword = process.env.KAFOU_DEMO_PASSWORD || "";

if (!demoPassword)
  throw new Error(
    "KAFOU_DEMO_PASSWORD must be supplied through private test configuration.",
  );
