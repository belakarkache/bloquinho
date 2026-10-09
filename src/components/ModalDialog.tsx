import { motion } from 'motion/react'
import { useEffect, useImperativeHandle, useRef, type ComponentProps, type Ref } from 'react'
import { quickFade } from './motion'

interface ModalDialogProps extends Omit<ComponentProps<'dialog'>, 'ref' | 'onCancel'> {
  ref?: Ref<HTMLDialogElement | null>
  onClose: () => void
  onEscape?: () => void
}

export function ModalDialog({ ref, onClose, onEscape = onClose, className = '', children, ...props }: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useImperativeHandle<HTMLDialogElement | null, HTMLDialogElement | null>(ref, () => dialogRef.current, [])

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        onEscape()
      }}
      className={`fixed inset-0 m-0 flex h-dvh max-h-none w-screen max-w-none justify-center border-0 bg-transparent text-ink ${className}`}
      {...props}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: quickFade }}
        onClick={onClose}
        className="absolute inset-0 bg-(--scrim) backdrop-blur-[3px]"
        aria-hidden="true"
      />
      {children}
    </dialog>
  )
}
