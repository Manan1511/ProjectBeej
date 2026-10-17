"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

let pendingNavigationStart: number | null = null;

function markNavigationStart() {
  pendingNavigationStart = performance.now();
}

export function NavigationTimingReporter() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    const startedAt = pendingNavigationStart;
    previousPath.current = pathname;
    pendingNavigationStart = null;
    if (startedAt === null) return;
    const name = "beej:navigation:route";
    performance.clearMeasures(name);
    performance.measure(name, { start: startedAt, end: performance.now() });
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      markNavigationStart();
    };
    const onPopState = () => markNavigationStart();
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (!navigation) return;
    const name = "beej:navigation:document";
    performance.clearMeasures(name);
    performance.measure(name, { start: navigation.startTime, end: navigation.domContentLoadedEventEnd });
  }, []);

  return null;
}
