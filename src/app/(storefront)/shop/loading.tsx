import Image from "next/image";
import { ShopCatalogFallback } from "@/components/ShopCatalog";

export default function ShopLoading() {
  return <main id="main-content" className="artifact-shop" aria-busy="true">
    <section className="catalog-hero artifact-shop-hero" aria-label="Shop all snacks">
      <Image src="/assets/leaves-dark.jpg" alt="" fill sizes="100vw" preload />
      <div className="catalog-hero-shade" />
      <div className="catalog-hero-copy artifact-shop-copy"><div className="artifact-shop-heading"><span className="eyebrow">The Beej pantry</span><h1>Shop all</h1></div><p>Snacks made from nature&apos;s humblest ingredients.<br />Free shipping on orders above ₹499.</p></div>
    </section>
    <ShopCatalogFallback />
  </main>;
}
