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

export function shouldPlaySproutVideo(intersecting: boolean, pageVisible: boolean): boolean {
  return intersecting && pageVisible;
}

export function SproutVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [inViewport, setInViewport] = useState(false);
  const [pageVisible, setPageVisible] = useState(false);

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

    const preloadObserver = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        preloadObserver.disconnect();
      }
    }, { rootMargin: "300px 0px" });
    const playbackObserver = new IntersectionObserver((entries) => setInViewport(entries.some((entry) => entry.isIntersecting)));
    const updatePageVisibility = () => setPageVisible(document.visibilityState === "visible");
    updatePageVisibility();
    document.addEventListener("visibilitychange", updatePageVisibility);
    preloadObserver.observe(container);
    playbackObserver.observe(container);
    return () => {
      preloadObserver.disconnect();
      playbackObserver.disconnect();
      document.removeEventListener("visibilitychange", updatePageVisibility);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !shouldLoad) return;
    if (shouldPlaySproutVideo(inViewport, pageVisible)) void video.play().catch(() => undefined);
    else video.pause();
  }, [inViewport, pageVisible, shouldLoad]);

  return (
    <div ref={containerRef} className="story-image artifact-story-image" role="img" aria-label="A sprout growing from the soil">
      {shouldLoad ? (
        <video
          ref={videoRef}
          className="artifact-story-seedling"
          src={SPROUT_VIDEO_SRC}
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
