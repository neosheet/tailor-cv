import * as React from "react"
import { Ellipsis, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ApplicationDetailSheet } from "@/components/applications/application-detail-sheet"
import { ApplicationFormDialog } from "@/components/applications/application-form-dialog"
import { DeleteApplicationDialog } from "@/components/applications/delete-application-dialog"
import {
  allApplications,
  createApplication,
  deleteApplication,
  findApplication,
  updateApplication,
} from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { APPLICATION_STATUSES, STATUS_LABEL } from "@/lib/application-status"
import { allCvs, findCv } from "@/lib/cv"
import { usePersonaStore } from "@/lib/persona-store"
import type { ApplicationStatus, DbApplication } from "@/mocks/types"

const ALL_STATUSES = "all"

/** Table + status filter + New Application — mirrors `CvListPanel`'s shape. */
export function ApplicationListPanel() {
  const store = useApplicationStore()
  const personaStore = usePersonaStore()

  const [creating, setCreating] = React.useState(false)
  const [editTarget, setEditTarget] = React.useState<DbApplication | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DbApplication | null>(null)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [statusFilter, setStatusFilter] = React.useState<ApplicationStatus | typeof ALL_STATUSES>(
    ALL_STATUSES
  )

  // Re-derived from the store on every render (rather than held in state
  // directly) so the Sheet keeps reflecting the latest row through repeated
  // status changes without a stale copy.
  const selectedApplication = selectedId ? findApplication(store, selectedId) ?? null : null

  const cvOptions = allCvs(personaStore).map((cv) => ({ value: cv.id, label: cv.name }))

  const rows = allApplications(store)
    .filter((application) => statusFilter === ALL_STATUSES || application.status === statusFilter)
    .map((application) => ({
      application,
      cv: application.cvId ? findCv(personaStore, application.cvId) : undefined,
    }))

  const filterOptions = [
    { value: ALL_STATUSES, label: "All" },
    ...APPLICATION_STATUSES.map((status) => ({ value: status, label: STATUS_LABEL[status] })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <Select
          items={filterOptions}
          value={statusFilter}
          onValueChange={(next) => setStatusFilter(next as ApplicationStatus | typeof ALL_STATUSES)}
        >
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          New Application
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>CV</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ application, cv }) => (
              <TableRow key={application.id}>
                <TableCell className="align-top font-medium whitespace-nowrap">
                  <Button
                    variant="link"
                    className="h-auto justify-start p-0 font-medium"
                    onClick={() => setSelectedId(application.id)}
                  >
                    {application.title}
                  </Button>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  <Badge variant="secondary">{STATUS_LABEL[application.status]}</Badge>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                  {application.sourceUrl ?? "—"}
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  {cv?.name ?? "—"}
                </TableCell>
                <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                  {new Date(application.updatedAt).toLocaleString()}
                </TableCell>
                <TableCell className="align-top">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${application.title}`}
                        />
                      }
                    >
                      <Ellipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuItem onClick={() => setEditTarget(application)}>
                          <PencilIcon />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(application)}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ApplicationFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New Application"
        confirmLabel="Create"
        cvOptions={cvOptions}
        onSubmit={async (fields) => {
          await createApplication(store, fields)
        }}
      />

      <ApplicationFormDialog
        open={editTarget !== null}
        onOpenChange={(next) => !next && setEditTarget(null)}
        title="Edit Application"
        confirmLabel="Save"
        initialTitle={editTarget?.title ?? ""}
        initialSourceUrl={editTarget?.sourceUrl ?? ""}
        initialVacancyDetail={editTarget?.vacancyDetail ?? ""}
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
        onClose={() => setSelectedId(null)}
        onEdit={(application) => setEditTarget(application)}
      />

      <DeleteApplicationDialog
        application={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteApplication(store, deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
