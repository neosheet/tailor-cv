import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Layout skeleton shared by every settings registry's "rename with live
 * validation" dialog (Tags/Skill Categories/Stage Templates) — the
 * Dialog/form/header/footer wrapper only. Each caller owns its own
 * validation, field set, and copy, and supplies the field(s) as `children`.
 */
export function RenameDialogShell({
  open,
  onCancel,
  onSubmit,
  title,
  description,
  submitDisabled,
  children,
}: {
  open: boolean
  onCancel: () => void
  onSubmit: (event: React.FormEvent) => void
  title: string
  description: React.ReactNode
  submitDisabled: boolean
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {children}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitDisabled}>
              Rename
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Layout skeleton shared by every settings registry's delete-confirmation
 * dialog — the AlertDialog/header/footer wrapper only. Each caller owns its
 * own in-use check and copy, and supplies any extra content (e.g. a batch's
 * badge list) as `children`.
 */
export function DeleteConfirmDialogShell({
  open,
  onCancel,
  onDelete,
  title,
  description,
  actionLabel,
  children,
}: {
  open: boolean
  onCancel: () => void
  onDelete: () => void
  title: string
  description: React.ReactNode
  actionLabel: string
  children?: React.ReactNode
}) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {children}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDelete}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
