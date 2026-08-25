import * as React from "react"
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  ArrowUpDownIcon,
  Ellipsis,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"
import { Link, useSearchParams } from "react-router"
import { formatDistanceToNow } from "date-fns"

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
import type { GlobalApplicationStatus, DbApplication } from "@/mocks/types"

const ALL_STATUSES = "all"

type SortField = "appliedAt" | "updatedAt"
type SortDir = "asc" | "desc"

/** Nulls (no `appliedAt` yet) always sort last, regardless of direction. */
function compareByDate(a: string | null, b: string | null, dir: SortDir): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1

  const diff = new Date(a).getTime() - new Date(b).getTime()
  return dir === "asc" ? diff : -diff
}

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

/** Clickable column header for the Applied/Updated date columns — click to sort, click again to flip direction. */
function SortableTableHead({
  label,
  active,
  dir,
  onClick,
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
}) {
  const Icon = active ? (dir === "asc" ? ArrowUpIcon : ArrowDownIcon) : ArrowUpDownIcon

  return (
    <TableHead
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground data-[active=true]:text-foreground"
        data-active={active}
      >
        {label}
        <Icon className="size-3.5" />
      </button>
    </TableHead>
  )
}

/** Table + status/search/tag filter + New Application — mirrors `CvListPanel`'s shape. */
export function ApplicationListPanel({ archived = false }: { archived?: boolean }) {
  const store = useApplicationStore()

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
  const [sortField, setSortField] = useSessionState<SortField>(
    `applications:${archived ? "archive" : "list"}:sort-field`,
    "appliedAt"
  )
  const [sortDir, setSortDir] = useSessionState<SortDir>(
    `applications:${archived ? "archive" : "list"}:sort-dir`,
    "desc"
  )

  // Clicking the active column flips direction; switching column starts
  // newest-first, the more common thing to want when re-sorting.
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  // Re-derived from the store on every render (rather than held in state
  // directly) so the Sheet keeps reflecting the latest row through repeated
  // status changes without a stale copy.
  const selectedApplication = selectedId ? findApplication(store, selectedId) ?? null : null

  const needle = query.trim().toLowerCase()

  const rows = allApplications(store)
    .filter((application) => (archived ? application.archivedAt !== null : application.archivedAt === null))
    .filter((application) => statusFilter === ALL_STATUSES || application.globalStatus === statusFilter)
    .filter((application) => !needle || applicationSearchableText(application).includes(needle))
    .filter((application) => tagFilter.every((tag) => application.tags.includes(tag)))
    .sort((a, b) => compareByDate(a[sortField], b[sortField], sortDir))

  // Offered tags come from the rows that survive the current filters, so every
  // suggestion narrows the list instead of emptying it.
  const availableTags = React.useMemo(
    () => [...new Set(rows.flatMap((application) => application.tags))].sort(),
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
              <SortableTableHead
                label="Applied"
                active={sortField === "appliedAt"}
                dir={sortDir}
                onClick={() => toggleSort("appliedAt")}
              />
              <TableHead>Status</TableHead>
              <TableHead>URL</TableHead>
              <SortableTableHead
                label="Updated"
                active={sortField === "updatedAt"}
                dir={sortDir}
                onClick={() => toggleSort("updatedAt")}
              />
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {emptyMessage(archived, query, tagFilter)}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((application) => (
                <TableRow
                  key={application.id}
                  className="cursor-pointer"
                  onClick={() =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev)
                      next.set("applicationId", application.id)
                      return next
                    })
                  }
                >
                  <TableCell className="align-top font-medium whitespace-nowrap">
                    <Link
                      to={`/applications/${application.id}`}
                      className="underline-offset-4 hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {application.title}
                    </Link>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {application.company ?? "—"}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {application.appliedAt
                      ? formatDistanceToNow(new Date(application.appliedAt), { addSuffix: true })
                      : "—"}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap">
                    <Badge variant="secondary">{GLOBAL_STATUS_LABEL[application.globalStatus]}</Badge>
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {application.sourceUrl ? (
                      <ExternalLink
                        href={application.sourceUrl}
                        className="underline underline-offset-4 hover:text-primary"
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="align-top whitespace-nowrap text-muted-foreground">
                    {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="align-top" onClick={(event) => event.stopPropagation()}>
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
        initialNote={editTarget?.note ?? null}
        initialTags={editTarget?.tags ?? []}
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
