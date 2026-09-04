import React from "react";

/**
 * Componente oficial de Badge/Pill do Nuvy Finance.
 *
 * @param {Object} props
 * @param {'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary'} [props.variant='neutral']
 * @param {'sm' | 'md'} [props.size='sm']
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Badge({
  variant = "neutral",
  size = "sm",
  icon,
  className = "",
  children,
  ...rest
}) {
  const variants = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-100 text-slate-600 border-slate-200",
    primary: "bg-emerald-100 text-emerald-800 border-emerald-300",
  };

  const sizes = {
    sm: "px-2.5 py-0.5 text-[10px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
  };

  const currentVariant = variants[variant] || variants.neutral;
  const currentSize = sizes[size] || sizes.sm;

  return (
    <span
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border ${currentVariant} ${currentSize} ${className}`}
      {...rest}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
