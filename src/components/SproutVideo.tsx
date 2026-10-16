"use client";

import { useEffect, useRef, useState } from "react";

export const SPROUT_VIDEO_SRC = "/assets/seed-sprout-b22cdee8a635.mp4";
export const SPROUT_VIDEO_DIMENSIONS = { width: 720, height: 1280 } as const;

type SproutVideoPreferences = {
  prefersReducedMotion: boolean;
  saveData: boolean;
  effectiveType?: string;
};

export function shouldLoadSproutVideo({ prefersReducedMotion, saveData, effectiveType }: SproutVideoPreferences): boolean {
  return !prefersReducedMotion && !saveData && effectiveType !== "slow-2g" && effectiveType !== "2g";
}

export function SproutVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const allowed = shouldLoadSproutVideo({
      prefersReducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      saveData: connection?.saveData ?? false,
      effectiveType: connection?.effectiveType,
    });

    if (!allowed) return;

    const container = containerRef.current;
    if (!container) return;

    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "300px 0px" });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="story-image artifact-story-image" role="img" aria-label="A sprout growing from the soil">
      {shouldLoad ? (
        <video
          className="artifact-story-seedling"
          src={SPROUT_VIDEO_SRC}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          poster="/assets/sprout-single.jpg"
          width={SPROUT_VIDEO_DIMENSIONS.width}
          height={SPROUT_VIDEO_DIMENSIONS.height}
          aria-hidden="true"
        >
          Your browser does not support this video.
        </video>
      ) : null}
    </div>
  );
}
