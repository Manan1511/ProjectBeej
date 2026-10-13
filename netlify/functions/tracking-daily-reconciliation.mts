import type { NetlifyFunction } from "@netlify/functions";
import { runDailyTrackingReconciliation } from "../../src/lib/tracking-reconciliation.js";

const dailyReconciliation: NetlifyFunction = {
  config: { schedule: "35 0 * * *" },
  async fetch() {
    try {
      const result = await runDailyTrackingReconciliation();
      return Response.json({ ok: true, ...result });
    } catch {
      return Response.json({ error: "Shopify reconciliation is temporarily unavailable." }, { status: 503 });
    }
  },
};

export default dailyReconciliation;
