export default function ProductLoading() {
  return <main id="main-content" className="artifact-product-page product-loading" aria-busy="true">
    <div className="product-page artifact-product-shell">
      <div className="breadcrumbs"><span>Shop</span><span>/</span><span>Snack</span></div>
      <div className="product-detail-grid artifact-product-layout">
        <div className="product-gallery"><div className="product-main-image product-loading-image" /><div className="product-thumbnails"><span /><span /><span /></div></div>
        <div className="product-information"><span className="product-loading-line" /><span className="product-loading-title" /><span className="product-loading-line" /><span className="product-loading-copy" /><span className="product-loading-copy" /><span className="product-loading-button" /></div>
      </div>
    </div>
  </main>;
}
