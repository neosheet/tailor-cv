import * as React from "react"
import { useSearchParams } from "react-router"

import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { ApplicationDetailSheet } from "@/components/applications/application-detail-sheet"
import { ApplicationFormDialog } from "@/components/applications/application-form-dialog"
import { allApplications, findApplication, updateApplication } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { GLOBAL_APPLICATION_STATUSES, GLOBAL_STATUS_LABEL } from "@/lib/application-status"
import { allCvs } from "@/lib/cv"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication } from "@/mocks/types"

/**
 * View-only pipeline board: one column per `GlobalApplicationStatus` (always
 * shown, even empty, so the whole pipeline shape is visible at a glance), no
 * drag-drop. Archived applications never appear here. Self-contained
 * selection/edit wiring mirrors `ApplicationListPanel` so this panel works
 * standalone on its own tab.
 */
export function ApplicationKanbanPanel() {
  const store = useApplicationStore()
  const personaStore = usePersonaStore()

  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get("applicationId")
  const [editTarget, setEditTarget] = React.useState<DbApplication | null>(null)

  // Re-derived from the store on every render (rather than held in state
  // directly), same reasoning as `ApplicationListPanel`.
  const selectedApplication = selectedId ? findApplication(store, selectedId) ?? null : null

  const cvOptions = allCvs(personaStore).map((cv) => ({ value: cv.id, label: cv.name }))

  const visible = allApplications(store).filter((application) => application.archivedAt === null)

  const columns = GLOBAL_APPLICATION_STATUSES.map((status) => ({
    status,
    applications: visible.filter((application) => application.globalStatus === status),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map(({ status, applications }) => (
          <div key={status} className="flex w-64 shrink-0 flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{GLOBAL_STATUS_LABEL[status]}</span>
              <Badge variant="secondary">{applications.length}</Badge>
            </div>

            <div className="flex flex-col gap-2">
              {applications.map((application) => (
                <button
                  key={application.id}
                  type="button"
                  className="w-full text-left"
                  onClick={() =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev)
                      next.set("applicationId", application.id)
                      return next
                    })
                  }
                >
                  <Card size="sm">
                    <CardHeader>
                      <CardTitle>{application.title}</CardTitle>
                      <div className="text-sm text-muted-foreground">
                        {application.company ?? "—"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {application.position ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(application.updatedAt).toLocaleString()}
                      </div>
                    </CardHeader>
                  </Card>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <ApplicationFormDialog
        open={editTarget !== null}
        onOpenChange={(next) => !next && setEditTarget(null)}
        title="Edit Application"
        confirmLabel="Save"
        initialTitle={editTarget?.title ?? ""}
        initialCompany={editTarget?.company ?? ""}
        initialPosition={editTarget?.position ?? ""}
        initialLocation={editTarget?.location ?? ""}
        initialJobType={editTarget?.jobType ?? null}
        initialWorkType={editTarget?.workType ?? null}
        initialDeadline={editTarget?.deadline ?? null}
        initialSourceUrl={editTarget?.sourceUrl ?? ""}
        initialVacancyDetail={editTarget?.vacancyDetail ?? ""}
        initialCoverLetter={editTarget?.coverLetter ?? ""}
        initialApplyVia={editTarget?.applyVia ?? ""}
        initialCvId={editTarget?.cvId ?? null}
        initialNote={editTarget?.note ?? null}
        initialTags={editTarget?.tags ?? []}
        cvOptions={cvOptions}
        onSubmit={async (fields) => {
          if (!editTarget) return
          await updateApplication(store, editTarget.id, fields)
        }}
      />

      <ApplicationDetailSheet
        application={selectedApplication}
        onClose={() =>
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.delete("applicationId")
            return next
          })
        }
        onEdit={(application) => setEditTarget(application)}
      />
    </div>
  )
}
