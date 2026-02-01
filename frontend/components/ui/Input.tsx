import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--app-ink-muted)] mb-1">
          {label}
        </label>
      )}
      <input
        className={`
          w-full px-3 py-2 border rounded-lg bg-[var(--app-surface-soft)] text-[var(--app-ink)]
          focus:outline-none focus:ring-2 focus:ring-[var(--app-ring)] focus:border-[var(--app-accent)]
          ${error ? 'border-red-500' : 'border-[var(--app-border)]'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
