import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  const baseStyles =
    "font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[var(--app-ring)]";

  const variantStyles = {
    primary:
      "bg-[var(--app-accent)] text-white hover:bg-[var(--app-accent-strong)] shadow-[0_12px_25px_rgba(0,0,0,0.15)]",
    secondary:
      "bg-[var(--app-surface-muted)] text-[var(--app-ink)] border border-[var(--app-border)] hover:bg-[var(--app-surface)]",
    danger:
      "bg-[#b24b31] text-white hover:bg-[#943d28] shadow-[0_10px_22px_rgba(0,0,0,0.12)]",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-base",
    lg: "px-6 py-3 text-lg",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
