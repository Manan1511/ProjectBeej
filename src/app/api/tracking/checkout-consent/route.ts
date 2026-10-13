import { handleCheckoutConsentRequest } from "@/lib/checkout-consent-handler";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleCheckoutConsentRequest(request);
}

export async function POST(request: Request) {
  return handleCheckoutConsentRequest(request);
}
