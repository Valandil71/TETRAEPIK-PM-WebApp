export function getWindowScrollY() {
  if (typeof window === "undefined") return 0;
  return window.scrollY || document.documentElement.scrollTop || 0;
}

export function restoreWindowScrollY(top: number) {
  const restore = () => {
    window.scrollTo({ top });
  };

  let secondFrame = 0;
  const firstFrame = window.requestAnimationFrame(() => {
    restore();
    secondFrame = window.requestAnimationFrame(restore);
  });
  const timeouts = [50, 150, 300, 600].map((delay) =>
    window.setTimeout(restore, delay)
  );

  return () => {
    window.cancelAnimationFrame(firstFrame);
    if (secondFrame) window.cancelAnimationFrame(secondFrame);
    timeouts.forEach((timeout) => window.clearTimeout(timeout));
  };
}

export function restoreElementIntoView(element: HTMLElement) {
  const restore = () => {
    element.scrollIntoView({ block: "center" });
  };

  let secondFrame = 0;
  const firstFrame = window.requestAnimationFrame(() => {
    restore();
    secondFrame = window.requestAnimationFrame(restore);
  });
  const timeouts = [50, 150, 300, 600].map((delay) =>
    window.setTimeout(restore, delay)
  );

  return () => {
    window.cancelAnimationFrame(firstFrame);
    if (secondFrame) window.cancelAnimationFrame(secondFrame);
    timeouts.forEach((timeout) => window.clearTimeout(timeout));
  };
}
