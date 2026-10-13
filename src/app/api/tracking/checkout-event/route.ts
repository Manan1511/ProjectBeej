import { handleCheckoutTrackingEvent } from "@/lib/checkout-event-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) { return handleCheckoutTrackingEvent(request); }
export async function OPTIONS(request: Request) { return handleCheckoutTrackingEvent(request); }
