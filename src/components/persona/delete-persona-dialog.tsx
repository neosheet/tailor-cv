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
 * Deleting a Persona cascades in the database to any CVs built from it
 * (`cvs.persona_id references personas(id) on delete cascade`) — the
 * confirmation says so, since that's not obvious from the button alone.
 */
export function DeletePersonaDialog({
  persona,
  cvCount,
  onCancel,
  onConfirm,
}: {
  persona: { name: string } | null
  /** How many saved CVs are built from this Persona, if known. */
  cvCount?: number
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={persona !== null} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{persona?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the Persona
            {cvCount ? ` and the ${cvCount} CV${cvCount === 1 ? "" : "s"} built from it` : " and any CVs built from it"}
            . This can't be undone.
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
