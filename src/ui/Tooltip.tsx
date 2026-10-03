import { cloneElement, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Tooltip. Small LCD-style label on hover/focus after 400 ms.

export function Tooltip({ text, children, side = 'top' }: { text: string; children: ReactElement<Record<string, unknown>>; side?: 'top' | 'bottom' }) {
  const [show, setShow] = useState(false);
  const timer = useRef<number | null>(null);
  const id = useId();
  const open = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShow(true), 400);
  };
  const close = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setShow(false);
  };
  return (
    <span className="relative inline-flex" onPointerEnter={open} onPointerLeave={close} onFocus={open} onBlur={close}>
      {cloneElement(children, { 'aria-describedby': show ? id : undefined })}
      {show && (
        <span id={id} role="tooltip" className={`lcd-tip pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap ${side === 'top' ? '-top-7' : 'top-full mt-1'}`}>
          {text}
        </span>
      )}
    </span>
  );
}
