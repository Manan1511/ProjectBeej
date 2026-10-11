import type { ShopifyPolicy } from "@/lib/storefront";
import { PolicyBody } from "@/components/PolicyBody";

export function PolicyPage({ title, intro, policy }: { title: string; intro: string; policy: ShopifyPolicy | null }) {
  return <main id="main-content" className="policy-page">
    <span className="eyebrow">Project Beej · Good to know</span><h1>{policy?.title || title}</h1>
    {policy ? <><p className="policy-updated">This policy is managed in Shopify.</p><PolicyBody body={policy.body} />{policy.url ? <a className="text-link" href={policy.url}>View policy in Shopify ↗</a> : null}</> : <div className="policy-pending"><h2>Policy setup pending</h2><p>{intro}</p><p>The merchant must add and approve this policy in Shopify Admin before launch. Once published, it will appear here automatically.</p></div>}
  </main>;
}
