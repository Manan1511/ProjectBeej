import Image from "next/image";
import { contentFromSettings, resolveAdminSiteSettings } from "@/lib/admin-content";
import type { SiteSettings } from "@/lib/types";

export function ShopEditorialSections({ settings: input = {} }: { settings?: SiteSettings } = {}) {
  const settings = resolveAdminSiteSettings(input);
  const content = contentFromSettings(settings);
  const copy = content.shopCopy;
  return <>
    {content.visibility.shopSnackSpotted ? <section className="catalog-section shop-spotted-section" aria-labelledby="shop-spotted-title">
      <header className="shop-spotted-heading">
        <h2 id="shop-spotted-title">{copy.spottedTitle}</h2>
        <p>{copy.spottedDescription}</p>
      </header>
      <div className="shop-spotted-grid">
        <figure className="shop-spotted-photo shop-spotted-pudina">
          <Image src="/assets/pudina-hands.jpg" alt="Project Beej Pudina makhana shared around a snack jar" fill sizes="(max-width: 760px) 50vw, (max-width: 1368px) 34vw, 460px" />
        </figure>
        <figure className="shop-spotted-photo shop-spotted-himalayan">
          <Image src="/assets/himalayan-hand.jpg" alt="Project Beej Himalayan Salt and Pepper makhana with pink salt and peppercorns" fill sizes="(max-width: 760px) 50vw, (max-width: 1368px) 34vw, 460px" />
        </figure>
        <figure className="shop-spotted-photo shop-spotted-cheese">
          <Image src="/assets/cheese-table.jpg" alt="Project Beej Cheese makhana on a sunny yellow table" fill sizes="(max-width: 760px) 50vw, (max-width: 1368px) 34vw, 460px" />
        </figure>
        <div className="shop-seed-banner">
          <Image src="/assets/sprout-single.jpg" alt="" fill sizes="(max-width: 760px) 100vw, (max-width: 1368px) 66vw, 900px" />
          <div className="shop-seed-banner-shade" />
          <h3>{copy.seedBannerLineOne}<br />{copy.seedBannerLineTwo}</h3>
        </div>
      </div>
    </section> : null}

    {content.visibility.shopBenefits ? <section className="shop-benefits-section" aria-label="Project Beej shopping benefits">
      <div className="shop-benefits-inner">
        <article className="shop-benefit"><h3>{copy.benefitOneTitle}</h3><p>{copy.benefitOneDescription}</p></article>
        <article className="shop-benefit"><h3>{copy.benefitTwoTitle}</h3><p>{copy.benefitTwoDescription}</p></article>
        <article className="shop-benefit"><h3>{copy.benefitThreeTitle}</h3><p>{copy.benefitThreeDescription}</p></article>
      </div>
    </section> : null}
  </>;
}
