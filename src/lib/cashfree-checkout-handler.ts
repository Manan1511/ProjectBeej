import { z } from "zod";

const indianPhone = z.string().trim().min(10).max(18).transform((value) => value.replace(/[^\d]/g, "")).transform((digits, context) => {
  const national = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(national)) {
    context.addIssue({ code: "custom", message: "Enter a valid Indian mobile number." });
    return z.NEVER;
  }
  return national;
});

export const cashfreeBuyerSchema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(80),
  lastName: z.string().trim().min(1, "Enter your last name.").max(80),
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((value) => value.toLowerCase()),
  phone: indianPhone,
}).strict();

export const cashfreeAddressSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  address1: z.string().trim().min(4, "Enter your street address.").max(200),
  address2: z.string().trim().max(200).optional().default(""),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  zip: z.string().trim().regex(/^\d{6}$/, "Enter a valid six-digit PIN code."),
}).strict();

const deliverySelectionsSchema = z.array(z.object({
  deliveryGroupId: z.string().min(1).max(200),
  deliveryOptionHandle: z.string().min(1).max(500),
}).strict()).min(1).max(10);

export const cashfreeShippingOptionsSchema = z.object({
  source: z.enum(["bag", "buy-now"]).default("bag"),
  buyer: cashfreeBuyerSchema,
  address: cashfreeAddressSchema,
  deliverySelections: deliverySelectionsSchema.optional(),
}).strict();

export const cashfreeCreateOrderSchema = z.object({
  source: z.enum(["bag", "buy-now"]).default("bag"),
  buyer: cashfreeBuyerSchema,
  address: cashfreeAddressSchema,
  deliverySelections: deliverySelectionsSchema,
  attemptId: z.string().uuid(),
}).strict();

export function checkoutRequestIsSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function readBoundedCheckoutJson(request: Request, maxBytes = 12_000): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return { ok: false, status: 413 };
  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  try {
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function checkoutPublicError(error: unknown): { message: string; status: number } {
  if (error && typeof error === "object" && "status" in error && typeof error.status === "number"
    && "message" in error && typeof error.message === "string") {
    return { message: error.message, status: error.status };
  }
  return { message: "Checkout could not be prepared. Try again or use Shopify checkout.", status: 502 };
}
