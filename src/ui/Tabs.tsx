import { useRef } from 'react';

// docs/UI_DESIGN.md → PRIMITIVES → Tabs. Segmented sunken track with a raised active segment.

export interface TabsProps<T extends string> {
  label: string;
  items: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  /** id prefix used to link tabs to panels (`${idPrefix}-panel-${value}`). */
  idPrefix?: string;
  className?: string;
}

export function Tabs<T extends string>({ label, items, value, onChange, idPrefix, className = '' }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number) => {
    const n = (i + items.length) % items.length;
    onChange(items[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className={`tabs flex h-8 items-stretch gap-[2px] rounded-sm p-[3px] ${className}`}>
      {items.map((it, i) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={idPrefix ? `${idPrefix}-tab-${it.value}` : undefined}
            aria-controls={idPrefix ? `${idPrefix}-panel-${it.value}` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active || undefined}
            className="tab label flex-1 rounded-[6px] px-s3"
            onClick={() => onChange(it.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') { e.preventDefault(); move(i + 1); }
              if (e.key === 'ArrowLeft') { e.preventDefault(); move(i - 1); }
            }}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
