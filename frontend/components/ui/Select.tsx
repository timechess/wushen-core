import React from 'react';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  error?: string;
}

export default function Select({
  label,
  options,
  error,
  className = '',
  ...props
}: SelectProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          className={`
            w-full appearance-none px-3 py-2 pr-10 border rounded-lg bg-[var(--app-surface-soft)] text-[var(--app-ink)]
            focus:outline-none focus:ring-2 focus:ring-[var(--app-ring)] focus:border-[var(--app-accent)]
            disabled:opacity-60 disabled:cursor-not-allowed
            ${error ? 'border-red-500' : 'border-[var(--app-border)]'}
            ${className}
          `}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
          <svg
            className="h-5 w-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
