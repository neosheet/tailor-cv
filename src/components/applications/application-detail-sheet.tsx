import { Maximize2Icon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ApplicationDetailView } from "@/components/applications/application-detail-view"
import type { DbApplication } from "@/mocks/types"

/**
 * Read-only-ish drawer opened on row click — wraps the shared
 * `ApplicationDetailView` (Job Detail / CV Preview / Timeline tabs) and adds
 * an "Open in full page" escape hatch to `/applications/:id`, which renders
 * the same view without the drawer's width constraint. Editing hands off to
 * `onEdit` rather than owning its own dialog instance — `ApplicationListPanel`
 * owns the single `ApplicationFormDialog` shared between the row menu and here.
 */
export function ApplicationDetailSheet({
  application,
  onClose,
  onEdit,
}: {
  application: DbApplication | null
  onClose: () => void
  onEdit: (application: DbApplication) => void
}) {
  return (
    <Sheet open={application !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{application?.title}</SheetTitle>
          <SheetDescription>Application details and status history.</SheetDescription>
        </SheetHeader>

        {application ? (
          <div className="flex flex-col gap-6 px-4 pb-4">
            <ApplicationDetailView application={application} onEdit={onEdit} />

            <Button
              variant="outline"
              render={<Link to={`/applications/${application.id}`} />}
              nativeButton={false}
            >
              <Maximize2Icon data-icon="inline-start" />
              Open in full page
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
