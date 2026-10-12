import { SanitizedHtml } from "@/components/SanitizedHtml";

export function PolicyBody({ body }: { body: string }) {
  return <SanitizedHtml html={body} className="policy-copy" />;
}
