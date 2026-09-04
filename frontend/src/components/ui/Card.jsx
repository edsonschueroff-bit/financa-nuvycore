import React from "react";

/**
 * Componente oficial de Card/Painel do Nuvy Finance.
 *
 * @param {Object} props
 * @param {'none' | 'sm' | 'md' | 'lg'} [props.padding='md']
 * @param {boolean} [props.hover=false]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Card({
  padding = "md",
  hover = false,
  className = "",
  children,
  ...rest
}) {
  const paddings = {
    none: "",
    sm: "p-3.5",
    md: "p-5",
    lg: "p-6",
  };

  const currentPadding = paddings[padding] || paddings.md;
  const hoverClass = hover ? "hover:border-slate-300 hover:shadow-card-hover transition-all" : "";

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${currentPadding} ${hoverClass} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
