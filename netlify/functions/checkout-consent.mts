import type { NetlifyFunction } from "@netlify/functions";
import { handleCheckoutConsentRequest } from "../../src/lib/checkout-consent-handler.js";

const checkoutConsent: NetlifyFunction = {
  config: { path: "/api/tracking/checkout-consent" },
  fetch(request) {
    return handleCheckoutConsentRequest(request);
  },
};

export default checkoutConsent;
