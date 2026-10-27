"use client";

import { useState } from "react";

export function AdminPreviewControls({ children, section, hasConflict }: { children: React.ReactNode; section: string; hasConflict: boolean }) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

  return <main className="admin-preview-page">
    <div className="admin-preview-toolbar">
      <div><a className="admin-back-link" href="/admin">← Back to editor</a><h1>{section} preview</h1><p>Saved draft preview. This view does not change the live storefront.</p></div>
      <div className="admin-preview-viewports" role="group" aria-label="Preview viewport">
        <button type="button" aria-pressed={viewport === "desktop"} onClick={() => setViewport("desktop")}>Desktop</button>
        <button type="button" aria-pressed={viewport === "mobile"} onClick={() => setViewport("mobile")}>Mobile</button>
      </div>
    </div>
    {hasConflict ? <p className="admin-conflict-banner" role="status">Published content changed in Shopify. This saved draft is based on an older version.</p> : null}
    <div className={`admin-preview-stage ${viewport === "mobile" ? "is-mobile" : "is-desktop"}`} onClickCapture={(event) => {
      if (event.target instanceof Element && event.target.closest("a")) event.preventDefault();
    }} onSubmitCapture={(event) => event.preventDefault()}>
      <div className="admin-preview-site">{children}</div>
    </div>
  </main>;
}
