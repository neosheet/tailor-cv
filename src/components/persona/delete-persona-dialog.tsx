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
 * Deleting a Persona does NOT delete any application — `applications.
 * cv_persona_id references personas(id) on delete set null`, so an
 * application using this Persona for its CV just loses that attachment
 * (its CV tab reverts to the lazy-setup empty state) rather than the
 * application itself disappearing. The confirmation says so, since that's
 * not obvious from the button alone.
 */
export function DeletePersonaDialog({
  persona,
  applicationCount,
  onCancel,
  onConfirm,
}: {
  persona: { name: string } | null
  /** How many applications use this Persona, if known. */
  applicationCount?: number
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
            {applicationCount
              ? `. ${applicationCount} application${applicationCount === 1 ? "" : "s"} using it for its CV will lose that attachment`
              : ""}
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
