import { useEffect, useRef, useState } from 'react';
import { useVerticalDrag } from './useDrag';

// docs/UI_DESIGN.md → PRIMITIVES → Lcd. Drag vertically to change, click to type, Enter commits, Esc cancels.

export interface LcdProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  width?: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  onChangeEnd?: () => void;
}

export function Lcd({ label, value, min, max, step = 1, format = (v) => String(v), width = 72, disabled, onChange, onChangeEnd }: LcdProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const snap = (v: number) => Math.round(Math.min(max, Math.max(min, v)) / step) * step;

  const drag = useVerticalDrag({
    value, min, max, disabled, pixels: 300,
    onChange: (v) => onChange(snap(v)),
    onEnd: onChangeEnd,
    onTap: () => {
      setText(String(value));
      setEditing(true);
    },
  });

  useEffect(() => {
    if (editing) input.current?.select();
  }, [editing]);

  const commitText = () => {
    const n = Number(text.replace(',', '.'));
    if (Number.isFinite(n)) {
      onChange(snap(n));
      onChangeEnd?.();
    }
    setEditing(false);
  };

  return (
    <div
      role="spinbutton"
      tabIndex={editing || disabled ? -1 : 0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={format(value)}
      className="lcd relative flex h-8 cursor-ns-resize touch-none select-none items-center justify-end px-s2"
      style={{ minWidth: width }}
      {...(editing ? {} : drag)}
      onKeyDown={(e) => {
        if (editing || disabled) return;
        const d = { ArrowUp: step, ArrowDown: -step, PageUp: step * 10, PageDown: -step * 10 }[e.key];
        if (d !== undefined) {
          e.preventDefault();
          onChange(snap(value + d));
          onChangeEnd?.();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          setText(String(value));
          setEditing(true);
        }
      }}
    >
      {editing ? (
        <input
          ref={input}
          aria-label={`${label} value`}
          className="w-full bg-transparent text-right outline-none"
          value={text}
          inputMode="decimal"
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitText();
            if (e.key === 'Escape') setEditing(false);
            e.stopPropagation();
          }}
        />
      ) : (
        <span>{format(value)}</span>
      )}
    </div>
  );
}
