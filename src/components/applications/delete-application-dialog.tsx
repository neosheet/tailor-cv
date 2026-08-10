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
 * Deleting an application is a plain row delete — `application_stages`
 * cascades via FK, and nothing else references an application's id. Direct
 * copy of `DeleteCvDialog`'s shape.
 */
export function DeleteApplicationDialog({
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
          <AlertDialogTitle>Delete this application?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the application and its stage timeline.
            This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
