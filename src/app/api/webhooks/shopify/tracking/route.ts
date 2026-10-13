import { after } from "next/server";
import { handleShopifyTrackingWebhook } from "@/lib/tracking-webhook-handler";
import { runTrackingOutbox } from "@/lib/tracking-dispatch";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const response = await handleShopifyTrackingWebhook(request);
  if (response.ok) after(async () => { await runTrackingOutbox().catch(() => undefined); });
  return response;
}
