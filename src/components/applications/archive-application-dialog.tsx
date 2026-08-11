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

/**
 * Archiving is a soft-hide, not a delete — reversible via Restore, so this
 * skips the destructive styling `DeleteApplicationDialog` uses.
 */
export function ArchiveApplicationDialog({
  application,
  onCancel,
  onConfirm,
}: {
  application: { title: string } | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog
      open={application !== null}
      onOpenChange={(next) => !next && onCancel()}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive this application?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be hidden from the applications list until restored from
            Archive.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Archive</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
