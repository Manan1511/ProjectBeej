import type { Context, NetlifyFunction } from "@netlify/functions";
import { handleNewsletterSubmission } from "../../src/lib/newsletter-handler.js";

const newsletter: NetlifyFunction = {
  config: { path: "/api/newsletter" },
  fetch(request: Request, context: Context) {
    return handleNewsletterSubmission(request, context.ip);
  },
};

export default newsletter;
