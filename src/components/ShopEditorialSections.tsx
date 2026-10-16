import Image from "next/image";

const benefits = [
  { title: "Free shipping", description: "On every order above ₹499." },
  { title: "Sealed fresh", description: "Packed for crunch, resealable to keep it." },
  { title: "Made in India", description: "From Surat, Gujarat, to your door." },
];

export function ShopEditorialSections() {
  return <>
    <section className="catalog-section shop-spotted-section" aria-labelledby="shop-spotted-title">
      <header className="shop-spotted-heading">
        <h2 id="shop-spotted-title">Snack spotted</h2>
        <p>From desk to mat to couch, Beej goes where you go.</p>
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
          <h3>Every snack starts<br />with a seed.</h3>
        </div>
      </div>
    </section>

    <section className="shop-benefits-section" aria-label="Project Beej shopping benefits">
      <div className="shop-benefits-inner">
        {benefits.map(({ title, description }) => (
          <article className="shop-benefit" key={title}>
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  </>;
}
