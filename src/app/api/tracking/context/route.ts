import { handleTrackingContextRequest } from "@/lib/tracking-context-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleTrackingContextRequest(request);
}
