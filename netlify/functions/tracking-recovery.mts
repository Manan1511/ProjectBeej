import type { NetlifyFunction } from "@netlify/functions";
import { runTrackingRecovery } from "../../src/lib/tracking-dispatch.js";

const trackingRecovery: NetlifyFunction = {
  config: { schedule: "*/15 * * * *" },
  async fetch() {
    try {
      await runTrackingRecovery();
      return Response.json({ ok: true });
    } catch {
      return Response.json({ error: "Tracking recovery is temporarily unavailable." }, { status: 503 });
    }
  },
};

export default trackingRecovery;
