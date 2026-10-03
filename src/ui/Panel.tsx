import type { HTMLAttributes, ReactNode } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Panel. Full primitive set lands in T2.
export interface PanelProps extends HTMLAttributes<HTMLElement> {
  label: string;
  screws?: boolean;
  children?: ReactNode;
}

export function Panel({ label, screws = false, className = '', style, children, ...rest }: PanelProps) {
  return (
    <section
      role="region"
      aria-label={label}
      className={`relative rounded-lg bg-panel shadow-raised ${className}`}
      style={{ borderTop: 'var(--hairline)', ...style }}
      {...rest}
    >
      {screws && (
        <>
          <Screw className="left-3 top-3" />
          <Screw className="right-3 top-3" />
        </>
      )}
      {children}
    </section>
  );
}

function Screw({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute h-1 w-1 rounded-full bg-panel-sunken shadow-sunken ${className}`}
    />
  );
}
