export default function CollectionLoading() {
  return <main id="main-content" aria-busy="true"><section className="collection-hero"><span className="eyebrow">Loading collection</span><h1>Meet the Beej range.</h1></section><section className="catalog-section shop-loading"><div className="shop-loading-grid" aria-hidden="true">{Array.from({ length: 4 }, (_, index) => <div className="shop-loading-card" key={index}><span className="shop-loading-image" /><span /><span /><span /></div>)}</div></section></main>;
}
