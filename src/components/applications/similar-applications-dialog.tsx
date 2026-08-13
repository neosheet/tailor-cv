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
 * Fires after a new application is created whose Company + URL match one or
 * more existing applications (active or archived, per
 * `findSimilarApplications`). Informational only — the create has already
 * gone through, so this never blocks or asks for confirmation, just points
 * at what else might be the same opportunity.
 */
export function SimilarApplicationsDialog({
  applications,
  onOpenChange,
}: {
  applications: DbApplication[] | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={applications !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Similar application{applications && applications.length > 1 ? "s" : ""} found</DialogTitle>
          <DialogDescription>
            Same company and URL as {applications && applications.length > 1 ? "these applications" : "this application"} already in your tracker.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <ItemGroup className="gap-1">
            {(applications ?? []).map((application) => (
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
        </DialogBody>
        <DialogFooter>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
