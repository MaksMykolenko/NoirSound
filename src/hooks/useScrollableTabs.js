import { useEffect, useRef } from 'react';

const EDGE_TOLERANCE = 2;

export default function useScrollableTabs(activeKey) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let animationFrame = 0;
    const updateOverflowState = () => {
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      container.dataset.overflowing = String(maxScroll > EDGE_TOLERANCE);
      container.dataset.atStart = String(container.scrollLeft <= EDGE_TOLERANCE);
      container.dataset.atEnd = String(container.scrollLeft >= maxScroll - EDGE_TOLERANCE);
    };
    const queueUpdate = () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(updateOverflowState);
    };

    updateOverflowState();
    container.addEventListener('scroll', queueUpdate, { passive: true });
    window.addEventListener('resize', queueUpdate);
    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(queueUpdate)
      : null;
    resizeObserver?.observe(container);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      container.removeEventListener('scroll', queueUpdate);
      window.removeEventListener('resize', queueUpdate);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    const selected = container?.querySelector('[aria-selected="true"], [aria-current="step"]');
    selected?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });

    const animationFrame = requestAnimationFrame(() => {
      if (!container) return;
      const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
      container.dataset.overflowing = String(maxScroll > EDGE_TOLERANCE);
      container.dataset.atStart = String(container.scrollLeft <= EDGE_TOLERANCE);
      container.dataset.atEnd = String(container.scrollLeft >= maxScroll - EDGE_TOLERANCE);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [activeKey]);

  return containerRef;
}
