"use client";

export function StorefrontDataError({ title, reset }: { title: string; reset: () => void }) {
  return <main id="main-content" className="storefront-data-error" role="alert">
    <span className="eyebrow">A quick pause</span>
    <h1>{title}</h1>
    <p>We couldn&apos;t reach the shop just now. Your bag and its contents are safe. Try again in a moment.</p>
    <button className="button button-dark" type="button" onClick={reset}>Try again</button>
  </main>;
}
