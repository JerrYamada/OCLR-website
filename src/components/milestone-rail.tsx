"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Horizontal milestone rail. A vertical mouse wheel scrolls the rail while the
 * pointer is over it, then yields to the page at either end. Trackpads and
 * keyboard users keep the native horizontal scroll.
 */
export function MilestoneRail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const rail = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const node = rail.current;
    if (!node) return;

    function onWheel(event: WheelEvent) {
      if (!node || event.ctrlKey || event.defaultPrevented) return;
      if (node.scrollWidth <= node.clientWidth + 1) return;

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? event.deltaX
          : event.deltaY;
      if (!delta) return;

      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? node.clientWidth
            : 1;
      const distance = delta * unit;
      const atStart = node.scrollLeft <= 0 && distance < 0;
      const atEnd =
        node.scrollLeft + node.clientWidth >= node.scrollWidth - 1 &&
        distance > 0;
      if (atStart || atEnd) return;

      event.preventDefault();
      node.scrollLeft += distance;
    }

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <ol ref={rail} className="event-milestones" aria-label={label} tabIndex={0}>
      {children}
    </ol>
  );
}
