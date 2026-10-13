import { handleNewsletterSubmission } from "@/lib/newsletter-handler";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return handleNewsletterSubmission(request);
}
