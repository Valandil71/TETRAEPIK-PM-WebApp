"use client";

import { useEffect, useState } from "react";

/**
 * Measures the height of the page's sticky filter bar so a sticky table header
 * can pin directly below it (instead of being hidden behind it).
 *
 * The filter bar height is variable (tabs, search, wrapping filter chips), so we
 * observe it with a ResizeObserver and expose the live pixel height. Pass the
 * returned `offset` to the table header's `top` (e.g. `style={{ top: offset }}`).
 *
 * Usage:
 *   const { ref, offset } = useStickyHeaderOffset();
 *   <div ref={ref} className="sticky top-0 z-40">...filters...</div>
 *   <ManagementTable headerOffset={offset} ... />
 */
export function useStickyHeaderOffset<T extends HTMLElement = HTMLDivElement>() {
  // Store the node in state so the measuring effect re-runs when it mounts.
  const [node, setNode] = useState<T | null>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (!node || typeof ResizeObserver === "undefined") return;

    const update = () => setOffset(node.getBoundingClientRect().height);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);

  return { ref: setNode, offset };
}
