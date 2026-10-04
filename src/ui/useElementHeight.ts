import { useLayoutEffect, useRef, useState } from 'react';

/** Content-box height of an element, kept current with a ResizeObserver (for controls that fill free space). */
export function useElementHeight<T extends HTMLElement>(fallback = 0) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setHeight(Math.floor(el.clientHeight));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}
