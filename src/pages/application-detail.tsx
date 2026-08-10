import { ArrowLeftIcon, PencilIcon, SendIcon } from "lucide-react"
import { Link, useParams } from "react-router"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useSidebar } from "@/components/ui/sidebar"
import { ApplicationDetailView } from "@/components/applications/application-detail-view"
import { ApplicationFormDialog } from "@/components/applications/application-form-dialog"
import { findApplication, updateApplication } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { GLOBAL_STATUS_LABEL } from "@/lib/application-status"
import { allCvs } from "@/lib/cv"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication } from "@/mocks/types"

/**
 * Full-page counterpart to `ApplicationDetailSheet`'s drawer — same
 * `ApplicationDetailView`, just with the room a drawer doesn't have, so it
 * builds its own header (a standalone back button, then title + status
 * badge + Edit alongside each other) rather than the drawer's Badge/Edit
 * row, and passes `variant="page"` to get the Job Detail tab's two-column
 * layout. Reached either via the drawer's "Open in full page" button or
 * directly by URL, so it owns its own `ApplicationFormDialog` edit instance
 * rather than relying on `ApplicationListPanel`'s.
 */

function ApplicationUnresolved() {
  return (
    <Empty className="min-h-72 flex-none border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SendIcon />
        </EmptyMedia>
        <EmptyTitle>No such application</EmptyTitle>
        <EmptyDescription>
          That application doesn&apos;t exist, or it has been deleted.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link to="/applications" />} nativeButton={false}>
          Back to Applications
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function ApplicationResolved({ application }: { application: DbApplication }) {
  const store = useApplicationStore()
  const personaStore = usePersonaStore()
  const [editing, setEditing] = useState(false)

  const cvOptions = allCvs(personaStore).map((cv) => ({ value: cv.id, label: cv.name }))

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="icon-sm"
        render={<Link to="/applications" />}
        nativeButton={false}
        aria-label="Back to Applications"
        className="self-start"
      >
        <ArrowLeftIcon />
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{application.title}</h1>
          <Badge variant="secondary">{GLOBAL_STATUS_LABEL[application.globalStatus]}</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      </div>

      <ApplicationDetailView application={application} onEdit={() => setEditing(true)} variant="page" />

      <ApplicationFormDialog
        open={editing}
        onOpenChange={setEditing}
        title="Edit Application"
        confirmLabel="Save"
        initialTitle={application.title}
        initialSourceUrl={application.sourceUrl ?? ""}
        initialVacancyDetail={application.vacancyDetail ?? ""}
        initialCoverLetter={application.coverLetter ?? ""}
        initialApplyVia={application.applyVia ?? ""}
        initialCvId={application.cvId}
        initialNote={application.note}
        initialTags={application.tags}
        cvOptions={cvOptions}
        onSubmit={async (fields) => {
          await updateApplication(store, application.id, fields)
        }}
      />
    </div>
  )
}

export function ApplicationDetailPage() {
  const { id } = useParams()
  const store = useApplicationStore()
  const application = id ? findApplication(store, id) : undefined

  // Icon-only nav on this page — mirrors `/cvs/:id/print`'s treatment, same
  // reasoning: the detail view needs the room, restored on the way out.
  const { setOpen } = useSidebar()
  useEffect(() => {
    setOpen(false)
    return () => setOpen(true)
  }, [setOpen])

  if (!application) {
    return <ApplicationUnresolved />
  }

  return <ApplicationResolved application={application} />
}
