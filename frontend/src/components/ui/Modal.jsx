import React, { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Componente oficial de Modal / Diálogo do Nuvy Finance.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {string | React.ReactNode} props.title
 * @param {string | React.ReactNode} [props.subtitle]
 * @param {React.ReactNode} [props.icon]
 * @param {'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'} [props.size='md']
 * @param {React.ReactNode} [props.footer]
 * @param {string} [props.className]
 * @param {React.ReactNode} props.children
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = "md",
  footer,
  className = "",
  children,
}) {
  // Fechar com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Prevenir scroll no body quando modal estiver aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizes = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-5xl",
    full: "max-w-6xl",
  };

  const currentSize = sizes[size] || sizes.md;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200 my-8 w-full ${currentSize} ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            {icon && (
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                {icon}
              </div>
            )}
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">{title}</h3>
              {subtitle && <p className="text-xs text-slate-400 font-medium mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Corpo com Scroll interno suave */}
        <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>

        {/* Footer Opcional */}
        {footer && (
          <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
