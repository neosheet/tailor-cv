import * as React from "react"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  Ellipsis,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { useSearchParams } from "react-router"
import { format, parseISO } from "date-fns"

import { ExternalLink } from "@/components/external-link"
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
import { SearchInput } from "@/components/search-input"
import { TagFilter } from "@/components/inventory/tag-filter"
import { ApplicationDetailSheet } from "@/components/applications/application-detail-sheet"
import { ApplicationFormDialog } from "@/components/applications/application-form-dialog"
import { ArchiveApplicationDialog } from "@/components/applications/archive-application-dialog"
import { DeleteApplicationDialog } from "@/components/applications/delete-application-dialog"
import { SimilarApplicationsDialog } from "@/components/applications/similar-applications-dialog"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { useSessionState } from "@/hooks/use-session-state"
import { stripHtml } from "@/lib/quill-html"
import {
  allApplications,
  archiveApplication,
  createApplication,
  deleteApplication,
  findApplication,
  findSimilarApplications,
  restoreApplication,
  updateApplication,
} from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { GLOBAL_APPLICATION_STATUSES, GLOBAL_STATUS_LABEL } from "@/lib/application-status"
import { allCvs, findCv } from "@/lib/cv"
import { usePersonaStore } from "@/lib/persona-store"
import type { GlobalApplicationStatus, DbApplication } from "@/mocks/types"

const ALL_STATUSES = "all"

/**
 * Everything search should match, flattened to one lowercase string. Mirrors
 * `searchableText` in `pool-panel.tsx`.
 */
function applicationSearchableText(application: DbApplication): string {
  return [application.title, stripHtml(application.vacancyDetail ?? "")]
    .join(" ")
    .toLowerCase()
}

/**
 * Why the table is empty, naming whichever filters are responsible. Mirrors
 * `emptyMessage` in `pool-panel.tsx`, with an archive-specific base message.
 */
function emptyMessage(archived: boolean, query: string, tags: string[]): string {
  const tagList = tags.map((tag) => `“${tag}”`).join(" and ")

  if (query && tags.length > 0) {
    return `No applications match “${query}” and carry ${tagList}.`
  }

  if (tags.length > 0) {
    return `No applications carry ${tagList}.`
  }

  if (query) {
    return `No applications match “${query}”.`
  }

  return archived ? "No archived applications." : "No applications yet."
}

/** Table + status/search/tag filter + New Application — mirrors `CvListPanel`'s shape. */
export function ApplicationListPanel({ archived = false }: { archived?: boolean }) {
  const store = useApplicationStore()
  const personaStore = usePersonaStore()

  const { dialog, get, open, close } = useDialogSearchParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedId = searchParams.get("applicationId")
  const dialogTargetId = get("id")
  const editTarget = dialog === "edit" && dialogTargetId ? findApplication(store, dialogTargetId) ?? null : null
  const archiveTarget = dialog === "archive" && dialogTargetId ? findApplication(store, dialogTargetId) ?? null : null
  const deleteTarget = dialog === "delete" && dialogTargetId ? findApplication(store, dialogTargetId) ?? null : null
  const [statusFilter, setStatusFilter] = React.useState<GlobalApplicationStatus | typeof ALL_STATUSES>(
    ALL_STATUSES
  )

  // Set right after a create whose Company matches existing applications —
  // see `findSimilarApplications`. Informational only, so it lives outside
  // the URL-synced dialog state the rest of this panel uses.
  const [similarApplications, setSimilarApplications] = React.useState<DbApplication[] | null>(null)

  // Keyed per tab so List and Archive filters don't collide, and outlive the
  // page the same way Inventory's pool filters do.
  const [query, setQuery] = useSessionState(`applications:${archived ? "archive" : "list"}:search`, "")
  const [tagFilter, setTagFilter] = useSessionState<string[]>(
    `applications:${archived ? "archive" : "list"}:tags`,
    []
  )

  // Re-derived from the store on every render (rather than held in state
  // directly) so the Sheet keeps reflecting the latest row through repeated
  // status changes without a stale copy.
  const selectedApplication = selectedId ? findApplication(store, selectedId) ?? null : null

  const cvOptions = allCvs(personaStore).map((cv) => ({ value: cv.id, label: cv.name }))

  const needle = query.trim().toLowerCase()

  const rows = allApplications(store)
    .filter((application) => (archived ? application.archivedAt !== null : application.archivedAt === null))
    .filter((application) => statusFilter === ALL_STATUSES || application.globalStatus === statusFilter)
    .filter((application) => !needle || applicationSearchableText(application).includes(needle))
    .filter((application) => tagFilter.every((tag) => application.tags.includes(tag)))
    .map((application) => ({
      application,
      cv: application.cvId ? findCv(personaStore, application.cvId) : undefined,
    }))

  // Offered tags come from the rows that survive the current filters, so every
  // suggestion narrows the list instead of emptying it.
  const availableTags = React.useMemo(
    () => [...new Set(rows.flatMap((row) => row.application.tags))].sort(),
    [rows]
  )

  const filterOptions = [
    { value: ALL_STATUSES, label: "All" },
    ...GLOBAL_APPLICATION_STATUSES.map((status) => ({ value: status, label: GLOBAL_STATUS_LABEL[status] })),
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} label="applications" />
          <TagFilter value={tagFilter} onChange={setTagFilter} available={availableTags} />
          <Select
            items={filterOptions}
            value={statusFilter}
            onValueChange={(next) => setStatusFilter(next as GlobalApplicationStatus | typeof ALL_STATUSES)}
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
        </div>

        {archived ? null : (
          <Button variant="outline" size="sm" onClick={() => open("new")}>
            <PlusIcon data-icon="inline-start" />
            New Application
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Deadline</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>URL</TableHead>
              <TableHead>CV</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  {emptyMessage(archived, query, tagFilter)}
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ application, cv }) => (
                <TableRow key={application.id}>
                  <TableCell className="align-top font-medium whitespace-nowrap">
                    <Button
                      variant="link"
                      className="h-auto justify-start p-0 font-medium"
                      onClick={() =>
                        setSearchParams((prev) => {
                          const next = new URLSearchParams(prev)
                          next.set("applicationId", application.id)
                          return next
                        })
                      }
                    >
                      {application.title}
                    </Button>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {application.company ?? "—"}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {application.deadline ? format(parseISO(application.deadline), "PP") : "—"}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <Badge variant="secondary">{GLOBAL_STATUS_LABEL[application.globalStatus]}</Badge>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {application.sourceUrl ? (
                      <ExternalLink
                        href={application.sourceUrl}
                        className="underline underline-offset-4 hover:text-primary"
                      />
                    ) : (
                      "—"
                    )}
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
                          <DropdownMenuItem onClick={() => open("edit", { id: application.id })}>
                            <PencilIcon />
                            Edit
                          </DropdownMenuItem>
                          {archived ? (
                            <>
                              <DropdownMenuItem
                                onClick={async () => {
                                  await restoreApplication(store, application.id)
                                }}
                              >
                                <ArchiveRestoreIcon />
                                Restore
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => open("delete", { id: application.id })}
                              >
                                <Trash2Icon />
                                Delete
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem onClick={() => open("archive", { id: application.id })}>
                              <ArchiveIcon />
                              Archive
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ApplicationFormDialog
        open={dialog === "new"}
        onOpenChange={(next) => !next && close()}
        title="New Application"
        confirmLabel="Create"
        cvOptions={cvOptions}
        onSubmit={async (fields) => {
          const duplicates = findSimilarApplications(store, fields.company)
          await createApplication(store, fields)
          if (duplicates.length > 0) setSimilarApplications(duplicates)
        }}
      />

      <ApplicationFormDialog
        open={editTarget !== null}
        onOpenChange={(next) => !next && close(["id"])}
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
        onEdit={(application) => open("edit", { id: application.id })}
      />

      <ArchiveApplicationDialog
        application={archiveTarget}
        onCancel={() => close(["id"])}
        onConfirm={async () => {
          if (!archiveTarget) return
          await archiveApplication(store, archiveTarget.id)
          close(["id"])
        }}
      />

      <DeleteApplicationDialog
        application={deleteTarget}
        onCancel={() => close(["id"])}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteApplication(store, deleteTarget.id)
          close(["id"])
        }}
      />

      <SimilarApplicationsDialog
        applications={similarApplications}
        onOpenChange={(next) => !next && setSimilarApplications(null)}
      />
    </div>
  )
}
