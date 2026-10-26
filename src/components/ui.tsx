import type { ComponentType } from 'react';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ComponentType<{ size?: number }> }[];
  small?: boolean;
}

export function Segmented<T extends string>({ label, value, onChange, options, small }: SegmentedProps<T>) {
  return (
    <div className={`segmented${small ? ' segmented--small' : ''}`} role="radiogroup" aria-label={label}>
      {options.map(({ value: v, label: l, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          className={v === value ? 'is-active' : ''}
          onClick={() => onChange(v)}
        >
          {Icon && <Icon size={15} />}
          {l}
        </button>
      ))}
    </div>
  );
}
