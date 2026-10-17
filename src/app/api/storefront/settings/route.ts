import { NextResponse } from "next/server";
import { getRequestCachedSiteSettings } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getRequestCachedSiteSettings();
    return NextResponse.json(settings, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60, stale-while-revalidate=60" },
    });
  } catch {
    return NextResponse.json({ error: "Storefront settings could not be loaded." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
