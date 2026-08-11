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
 * Deleting a CV is a plain row delete — nothing else references a CV's id
 * (unlike deleting a Persona, which cascades to any CVs built from it).
 */
export function DeleteCvDialog({
  cv,
  onCancel,
  onConfirm,
}: {
  cv: { name: string } | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={cv !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{cv?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the CV. This can't be undone.
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
