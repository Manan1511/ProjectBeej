"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { emitCommerceEvent } from "@/lib/tracking-client";

export function TrackedOutboundLink({
  href,
  kind,
  children,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; kind: "whatsapp" | "email"; children: ReactNode }) {
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (event.defaultPrevented) return;
        emitCommerceEvent({ name: kind === "whatsapp" ? "whatsapp_click" : "email_click", link_domain: kind === "whatsapp" ? "whatsapp.com" : "email" });
      }}
    >
      {children}
    </a>
  );
}

export function ConsentSettingsButton({ children = "Privacy settings", className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <button
      className={className}
      type="button"
      onClick={() => window.dispatchEvent(new Event("beej:open-consent-settings"))}
    >
      {children}
    </button>
  );
}
