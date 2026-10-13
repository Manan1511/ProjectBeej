import type { NetlifyFunction } from "@netlify/functions";
import { handleCheckoutTrackingEvent } from "../../src/lib/checkout-event-handler.js";

const checkoutTrackingEvent: NetlifyFunction = {
  config: { path: "/api/tracking/checkout-event" },
  fetch(request) { return handleCheckoutTrackingEvent(request); },
};

export default checkoutTrackingEvent;
