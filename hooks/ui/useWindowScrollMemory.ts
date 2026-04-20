"use client";

import { useEffect, useRef } from "react";
import { getWindowScrollY } from "@/utils/scrollRestoration";

const NAVIGATION_SCROLL_WRITE_GRACE_MS = 1000;

interface UseWindowScrollMemoryOptions {
  scrollY: number;
  setScrollY: (scrollY: number) => void;
}

function isInternalNavigationLink(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return false;

  const href = anchor.getAttribute("href");
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    anchor.target === "_blank"
  ) {
    return false;
  }

  const targetUrl = new URL(href, window.location.href);
  if (targetUrl.origin !== window.location.origin) return false;

  const currentUrl = new URL(window.location.href);
  return (
    targetUrl.pathname !== currentUrl.pathname ||
    targetUrl.search !== currentUrl.search
  );
}

export function useWindowScrollMemory({
  scrollY,
  setScrollY,
}: UseWindowScrollMemoryOptions) {
  const lastScrollY = useRef(scrollY);
  const ignoreScrollWritesUntil = useRef(0);

  useEffect(() => {
    lastScrollY.current = scrollY;
  }, [scrollY]);

  useEffect(() => {
    let animationFrame = 0;

    if (lastScrollY.current > 0) {
      ignoreScrollWritesUntil.current =
        window.performance.now() + NAVIGATION_SCROLL_WRITE_GRACE_MS;
    }

    const shouldIgnoreScrollY = (nextScrollY: number) =>
      window.performance.now() < ignoreScrollWritesUntil.current &&
      nextScrollY === 0 &&
      lastScrollY.current > 0;

    const saveScrollY = (nextScrollY = getWindowScrollY()) => {
      if (shouldIgnoreScrollY(nextScrollY)) return;

      const scrollY = nextScrollY;
      if (scrollY === lastScrollY.current) return;

      lastScrollY.current = scrollY;
      setScrollY(scrollY);
    };

    const handleClickCapture = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        !isInternalNavigationLink(event.target)
      ) {
        return;
      }

      saveScrollY();
      ignoreScrollWritesUntil.current =
        window.performance.now() + NAVIGATION_SCROLL_WRITE_GRACE_MS;
    };

    const handleScroll = () => {
      const scrollY = getWindowScrollY();
      if (shouldIgnoreScrollY(scrollY)) return;

      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => saveScrollY(scrollY));
    };

    document.addEventListener("click", handleClickCapture, true);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.removeEventListener("click", handleClickCapture, true);
      window.removeEventListener("scroll", handleScroll);
      setScrollY(lastScrollY.current);
    };
  }, [setScrollY]);
}
