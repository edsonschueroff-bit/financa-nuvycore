import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Componente oficial de Botão do Nuvy Finance (Precision Emerald).
 *
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'danger' | 'dark' | 'outline' | 'ghost'} [props.variant='primary']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {boolean} [props.loading=false]
 * @param {React.ReactNode} [props.icon]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  icon,
  className = "",
  children,
  type = "button",
  ...rest
}) {
  // Variantes de cores e estilos
  const variants = {
    primary:
      "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-600/10 border border-transparent",
    secondary:
      "bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 border border-slate-200",
    danger:
      "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-600/10 border border-transparent",
    dark:
      "bg-slate-900 hover:bg-black active:bg-slate-950 text-white shadow-md shadow-slate-900/10 border border-transparent",
    outline:
      "bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs",
    ghost:
      "bg-transparent hover:bg-slate-100 active:bg-slate-200 text-slate-600 hover:text-slate-900 border border-transparent",
  };

  // Tamanhos e alturas
  const sizes = {
    sm: "h-8 px-3 py-1 text-xs gap-1.5",
    md: "h-9 px-4 py-2 text-xs gap-2",
    lg: "h-11 px-6 py-2.5 text-sm gap-2.5",
  };

  const currentVariant = variants[variant] || variants.primary;
  const currentSize = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-semibold rounded-xl transition-all select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${currentVariant} ${currentSize} ${className}`}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      {children}
    </button>
  );
}
