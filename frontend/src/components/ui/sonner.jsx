import { Toaster as Sonner } from "sonner"

const Toaster = ({ ...props }) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white group-[.toaster]:text-slate-900 group-[.toaster]:border-slate-200 group-[.toaster]:shadow-lg group-[.toaster]:rounded-xl text-xs font-medium",
          description: "group-[.toast]:text-slate-500",
          actionButton:
            "group-[.toast]:bg-emerald-600 group-[.toast]:text-white font-semibold rounded-lg text-xs",
          cancelButton:
            "group-[.toast]:bg-slate-100 group-[.toast]:text-slate-600 rounded-lg text-xs",
          success:
            "group-[.toaster]:border-emerald-200 group-[.toaster]:text-emerald-950",
          error:
            "group-[.toaster]:border-rose-200 group-[.toaster]:text-rose-950",
          warning:
            "group-[.toaster]:border-amber-200 group-[.toaster]:text-amber-950",
          info:
            "group-[.toaster]:border-blue-200 group-[.toaster]:text-blue-950",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
