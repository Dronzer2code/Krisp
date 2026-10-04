import type { ButtonHTMLAttributes, ReactNode } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → LedButton. Raised square button with an LED dot top-right.

export interface LedButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string;
  on?: boolean;
  /** LED colour when on (default accent). */
  color?: string;
  /** Toggle buttons expose aria-pressed; action buttons do not. */
  toggle?: boolean;
  size?: number;
  /** Hide the LED dot (plain action buttons such as Play / Return to start). */
  led?: boolean;
  wide?: boolean;
  children?: ReactNode;
}

export function LedButton({ label, on = false, color = 'var(--led-on)', toggle = true, size = 28, led = true, wide, children, className = '', style, ...rest }: LedButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={toggle ? on : undefined}
      className={`led-btn relative inline-flex shrink-0 items-center justify-center gap-s1 ${className}`}
      style={{ minWidth: size, height: size, padding: wide ? '0 10px 0 8px' : undefined, ...style }}
      {...rest}
    >
      {led && <span aria-hidden="true" className="led absolute right-[4px] top-[4px] h-[6px] w-[6px] rounded-full" data-on={on || undefined} style={{ ['--led' as string]: color }} />}
      {children}
    </button>
  );
}

/** Stand-alone LED indicator (save status, model status, GR). */
export function Led({ on = true, color, label, size = 8 }: { on?: boolean; color: string; label?: string; size?: number }) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="led inline-block shrink-0 rounded-full"
      data-on={on || undefined}
      style={{ width: size, height: size, ['--led' as string]: color }}
    />
  );
}
