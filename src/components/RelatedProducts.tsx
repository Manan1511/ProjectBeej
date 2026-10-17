import Link from "next/link";
import { getCardProducts } from "@/lib/storefront";
import { ProductGrid } from "@/components/ProductGrid";

export function RelatedProductsFallback() {
  return <section className="related-section" aria-label="Related snacks" aria-busy="true"><div className="section-heading"><div><span className="eyebrow">Another round?</span><h2>You might also like</h2></div><Link className="text-link" href="/shop">Shop all snacks ↗</Link></div><div className="related-skeleton" aria-hidden="true"><span /><span /><span /><span /></div></section>;
}

export async function RelatedProducts({ currentProductId }: { currentProductId: string }) {
  let products;
  try { products = await getCardProducts(); }
  catch { return <section className="related-section" role="status"><p>More snacks are temporarily unavailable.</p><Link className="text-link" href="/shop">Shop all snacks ↗</Link></section>; }
  const related = products.filter((product) => product.id !== currentProductId).slice(0, 4);
  if (!related.length) return null;
  return <section className="related-section"><div className="section-heading"><div><span className="eyebrow">Another round?</span><h2>You might also like</h2></div><Link className="text-link" href="/shop">Shop all snacks ↗</Link></div><ProductGrid products={related} listName="Related products" /></section>;
}
