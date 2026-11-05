import { useEffect, useId, useRef, useState } from 'react';
import { IconCaret, IconCheck } from './Icons';

interface Option<T> {
  value: T;
  label: string;
}

interface DropdownProps<T> {
  label: string;
  /** Button caption; defaults to the selected option's label. */
  caption?: string;
  value?: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** Long lists spread over several columns instead of scrolling. */
  columns?: number;
}

export function Dropdown<T extends string | number>({ label, caption, value, options, onChange, className, columns = 1 }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={`dropdown ${className ?? ''}`} ref={root}>
      <button
        type="button"
        className="dropdown__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <span>{caption ?? selected?.label ?? label}</span>
        <IconCaret width={16} height={16} />
      </button>
      {open && (
        <ul className={`dropdown__menu${columns > 1 ? ' dropdown__menu--columns' : ''}`} style={columns > 1 ? { columnCount: columns } : undefined} id={id} role="listbox" aria-label={label}>
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onChange(o.value);
                }}
              >
                {o.value === value && <IconCheck width={14} height={14} />}
                <span>{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
