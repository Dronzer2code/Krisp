// docs/UI_DESIGN.md → PRIMITIVES → Toggle. 2-position switch, labels on both sides.

export interface ToggleProps<L extends string, R extends string> {
  label: string;
  left: L;
  right: R;
  value: L | R;
  disabled?: boolean;
  onChange: (v: L | R) => void;
}

export function Toggle<L extends string, R extends string>({ label, left, right, value, disabled, onChange }: ToggleProps<L, R>) {
  const isRight = value === right;
  return (
    <div className="flex items-center gap-s2" style={{ opacity: disabled ? 0.45 : 1 }}>
      <button type="button" tabIndex={-1} className={`label ${!isRight ? 'text-ink' : ''}`} onClick={() => !disabled && onChange(left)}>{left}</button>
      <button
        type="button"
        role="switch"
        aria-checked={isRight}
        aria-label={`${label}: ${value}`}
        disabled={disabled}
        className="toggle relative h-[26px] w-[64px] shrink-0 rounded-full"
        onClick={() => onChange(isRight ? left : right)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(left); }
          if (e.key === 'ArrowRight') { e.preventDefault(); onChange(right); }
        }}
      >
        <span className="toggle-thumb absolute top-[3px] h-[20px] w-[30px] rounded-full" style={{ left: isRight ? 31 : 3 }} />
      </button>
      <button type="button" tabIndex={-1} className={`label ${isRight ? 'text-ink' : ''}`} onClick={() => !disabled && onChange(right)}>{right}</button>
    </div>
  );
}
