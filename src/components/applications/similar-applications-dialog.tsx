import { Link } from "react-router"

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Badge } from "@/components/ui/badge"
import { GLOBAL_STATUS_LABEL } from "@/lib/application-status"
import type { DbApplication } from "@/mocks/types"

/**
 * The matched-applications list — shared by `SimilarApplicationsDialog`
 * below and the detail view's combined `ApplicationCheckButton` dialog
 * (`application-check-button.tsx`), so the row markup isn't duplicated.
 */
export function DuplicateApplicationsList({ applications }: { applications: DbApplication[] }) {
  return (
    <ItemGroup className="gap-1">
      {applications.map((application) => (
        <Item key={application.id} variant="outline" render={<Link to={`/applications/${application.id}`} />}>
          <ItemContent>
            <ItemTitle>{application.title}</ItemTitle>
            <ItemDescription>{application.company}</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Badge variant="secondary">{GLOBAL_STATUS_LABEL[application.globalStatus]}</Badge>
            {application.archivedAt ? <Badge variant="outline">Archived</Badge> : null}
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

/**
 * Fires after a new application is created whose Company matches one or more
 * existing applications (active or archived, per `findSimilarApplications`).
 * Informational only — never blocks or asks for confirmation, just points at
 * what else might be the same opportunity. `applications` may be an empty
 * array (a manual check that found nothing) as well as `null` (closed) or a
 * non-empty list.
 */
export function SimilarApplicationsDialog({
  applications,
  onOpenChange,
}: {
  applications: DbApplication[] | null
  onOpenChange: (open: boolean) => void
}) {
  const found = applications ?? []

  return (
    <Dialog open={applications !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {found.length > 0 ? `Similar application${found.length > 1 ? "s" : ""} found` : "No duplicates found"}
          </DialogTitle>
          <DialogDescription>
            {found.length > 0
              ? `Same company as ${found.length > 1 ? "these applications" : "this application"} already in your tracker.`
              : "No other applications in your tracker share this company."}
          </DialogDescription>
        </DialogHeader>
        {found.length > 0 ? (
          <DialogBody>
            <DuplicateApplicationsList applications={found} />
          </DialogBody>
        ) : null}
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
