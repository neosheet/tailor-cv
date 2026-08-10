import * as React from "react"
import { PencilIcon } from "lucide-react"
import { Link } from "react-router"

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
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { APPLICATION_STATUSES, STATUS_LABEL } from "@/lib/application-status"
import { applicationHistory, setApplicationStatus } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { findCv } from "@/lib/cv"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"
import type { ApplicationStatus, DbApplication } from "@/mocks/types"

/**
 * Read-only detail view opened on row click — title/source/vacancy detail/
 * apply via/attached CV, the status `Select` (with the freeze confirmation),
 * and the status history timeline. Editing fields (title/source/vacancy
 * detail/apply via/CV) is deliberately *not* inline here — `onEdit` hands
 * off to whichever `ApplicationFormDialog` instance the caller already owns
 * (`ApplicationListPanel` owns one, opened either from a row's menu or from
 * here), so the edit-dialog-open state lives in exactly one place rather
 * than being duplicated between the Sheet and the list panel.
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
  const applicationStore = useApplicationStore()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()

  const [pendingStatus, setPendingStatus] = React.useState<ApplicationStatus | null>(null)
  const [freezing, setFreezing] = React.useState(false)

  const cv = application?.cvId ? findCv(personaStore, application.cvId) : undefined
  const history = application
    ? [...applicationHistory(applicationStore, application.id)].reverse()
    : []

  async function handleStatusChange(next: ApplicationStatus) {
    if (!application || next === application.status) return

    // Mirrors `setApplicationStatus`'s own once-only freeze condition
    // exactly — only this specific transition shows the confirmation.
    if (application.status === "draft" && next !== "draft") {
      setPendingStatus(next)
      return
    }

    await setApplicationStatus(
      applicationStore,
      personaStore,
      inventoryStore,
      application.id,
      next
    )
  }

  async function confirmFreeze() {
    if (!application || !pendingStatus) return

    setFreezing(true)
    try {
      await setApplicationStatus(
        applicationStore,
        personaStore,
        inventoryStore,
        application.id,
        pendingStatus
      )
      setPendingStatus(null)
    } finally {
      setFreezing(false)
    }
  }

  const statusGated = application?.status === "draft" && !application.cvId

  return (
    <>
      <Sheet open={application !== null} onOpenChange={(next) => !next && onClose()}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{application?.title}</SheetTitle>
            <SheetDescription>
              Application details and status history.
            </SheetDescription>
          </SheetHeader>

          {application ? (
            <div className="flex flex-col gap-6 px-4 pb-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary">{STATUS_LABEL[application.status]}</Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(application)}
                >
                  <PencilIcon data-icon="inline-start" />
                  Edit
                </Button>
              </div>

              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Source</dt>
                  <dd>{application.sourceUrl ?? "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Vacancy detail</dt>
                  <dd className="whitespace-pre-wrap">
                    {application.vacancyDetail ?? "—"}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Apply via</dt>
                  <dd>{application.applyVia ?? "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">CV</dt>
                  <dd>{cv?.name ?? "—"}</dd>
                </div>
              </dl>

              <Button
                variant="link"
                className="h-auto justify-start p-0"
                render={<Link to={`/applications/${application.id}/cv`} />}
                nativeButton={false}
              >
                View attached CV
              </Button>

              <Field>
                <FieldLabel htmlFor="application-status">Status</FieldLabel>
                <Select
                  items={APPLICATION_STATUSES.map((status) => ({
                    value: status,
                    label: STATUS_LABEL[status],
                  }))}
                  value={application.status}
                  onValueChange={(next) => handleStatusChange(next as ApplicationStatus)}
                >
                  <SelectTrigger id="application-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {APPLICATION_STATUSES.map((status) => (
                        <SelectItem
                          key={status}
                          value={status}
                          disabled={statusGated && status !== "draft"}
                        >
                          {STATUS_LABEL[status]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {statusGated ? (
                  <p className="text-xs text-muted-foreground">
                    Attach a CV before changing status.
                  </p>
                ) : null}
              </Field>

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Status history</h3>
                <ul className="flex flex-col gap-2">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <Badge variant="secondary">{STATUS_LABEL[entry.status]}</Badge>
                      <span className="text-muted-foreground">
                        {new Date(entry.changedAt).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(next) => !next && setPendingStatus(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Freeze the attached CV?</AlertDialogTitle>
            <AlertDialogDescription>
              This freezes a copy of the attached CV as it looks right now. Later
              edits to the CV won&apos;t affect this application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingStatus(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction disabled={freezing} onClick={confirmFreeze}>
              {freezing ? "Freezing…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
