import { useEffect, useRef, useState } from 'react';

import { prefersReducedMotion } from './layout';

function canAnimate() {
  return typeof IntersectionObserver !== 'undefined' && !prefersReducedMotion();
}

/**
 * Score rings and bars grow in once their block scrolls into view. While `pre` is true the block
 * carries the "pre" class, which holds them at zero; it turns false (and they animate) the first
 * time the block is on screen with its data loaded.
 */
export function useReveal<T extends Element>(ready = true) {
  const ref = useRef<T | null>(null);
  const [pre, setPre] = useState(canAnimate);

  useEffect(() => {
    if (!pre || !ready) return;
    const node = ref.current;
    if (!node) return;
    let first = 0;
    let second = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        // Two frames, so the browser paints the zero state before the transition starts.
        first = requestAnimationFrame(() => {
          second = requestAnimationFrame(() => setPre(false));
        });
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [pre, ready]);

  return [ref, pre] as const;
}
