import { NextRequest, NextResponse } from "next/server";
import { consumeNewsletterRateLimit, subscribeWithConsent } from "@/lib/newsletter";
import { newsletterInputSchema } from "@/lib/newsletter-validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  if (body && typeof body === "object" && "company" in body && typeof body.company === "string" && body.company.length > 0) {
    return NextResponse.json({ success: true });
  }

  const parsed = newsletterInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and choose the email updates checkbox." }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim() || "unknown";
  if (!consumeNewsletterRateLimit(ip)) return NextResponse.json({ error: "Too many sign-up attempts. Try again in a minute." }, { status: 429 });

  try {
    await subscribeWithConsent(parsed.data.email);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Email sign-up is temporarily unavailable. Please try again later." }, { status: 503 });
  }
}
