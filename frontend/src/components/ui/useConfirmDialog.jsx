import React, { useState, useCallback, useRef } from "react"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./alert-dialog"

export function useConfirmDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [dialogConfig, setDialogConfig] = useState({
    title: "Confirmar ação",
    description: "Você tem certeza que deseja prosseguir?",
    confirmText: "Confirmar",
    cancelText: "Cancelar",
    variant: "danger",
  })

  const resolveRef = useRef(null)

  const confirm = useCallback((options = {}) => {
    setDialogConfig({
      title: options.title || "Confirmar ação",
      description: options.description || "Você tem certeza que deseja prosseguir?",
      confirmText: options.confirmText || "Confirmar",
      cancelText: options.cancelText || "Cancelar",
      variant: options.variant || "danger",
    })
    setIsOpen(true)

    return new Promise((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    if (resolveRef.current) {
      resolveRef.current(true)
      resolveRef.current = null
    }
  }, [])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    if (resolveRef.current) {
      resolveRef.current(false)
      resolveRef.current = null
    }
  }, [])

  const ConfirmDialog = useCallback(() => {
    return (
      <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {dialogConfig.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              variant={dialogConfig.variant}
              onClick={handleConfirm}
            >
              {dialogConfig.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }, [isOpen, dialogConfig, handleCancel, handleConfirm])

  return { confirm, ConfirmDialog }
}
