import type { NetlifyFunction } from "@netlify/functions";
import { handleTrackingContextRequest } from "../../src/lib/tracking-context-handler.js";

const trackingContext: NetlifyFunction = {
  config: { path: "/api/tracking/context" },
  fetch(request, context) {
    return handleTrackingContextRequest(request, context.ip);
  },
};

export default trackingContext;
