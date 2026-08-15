import * as React from "react"
import { FileTextIcon, PencilIcon, TriangleAlert } from "lucide-react"
import { Link } from "react-router"
import { format, parseISO } from "date-fns"

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
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink } from "@/components/external-link"
import { ResumeRender } from "@/components/cv/resume-render"
import { SkillsCheckDialog } from "@/components/skills/skills-check-dialog"
import { TimelineTab } from "@/components/applications/timeline-tab"
import { VacancyDetailContent } from "@/components/applications/vacancy-detail-content"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { useTabSearchParam } from "@/hooks/use-tab-search-param"
import { GLOBAL_APPLICATION_STATUSES, GLOBAL_STATUS_LABEL } from "@/lib/application-status"
import { JOB_TYPE_LABEL } from "@/lib/application-job-type"
import { WORK_TYPE_LABEL } from "@/lib/application-work-type"
import { resolveApplicationCv, setGlobalApplicationStatus, updateApplication } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { findCv } from "@/lib/cv"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"
import { findMissingSkills, skillTitlesOf } from "@/lib/skill-check"
import type { GlobalApplicationStatus, DbApplication, DbCv } from "@/mocks/types"

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function formatDeadline(deadline: string | null): string {
  return deadline ? format(parseISO(deadline), "PP") : "—"
}

/** The URL field — link to the job opportunity page — shared by both `variant`s. */
function SourceUrlField({ application }: { application: DbApplication }) {
  return (
    <DetailField label="URL">
      {application.sourceUrl ? (
        <ExternalLink
          href={application.sourceUrl}
          className="underline underline-offset-4 hover:text-primary"
        />
      ) : (
        "—"
      )}
    </DetailField>
  )
}

/**
 * The last saved Check result plus the trigger to reopen `SkillsCheckDialog`
 * — shared by both `variant`s' sidebar `dl`. Disabled (no trigger) when no CV
 * is attached, since there's nothing to check against.
 */
function MissingSkillsField({
  application,
  onOpenCheck,
}: {
  application: DbApplication
  onOpenCheck: () => void
}) {
  return (
    <DetailField label="Missing skills">
      <div className="flex flex-col items-start gap-2">
        {application.missingSkills && application.missingSkills.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {application.missingSkills.map((skill) => (
              <Badge key={skill} variant="destructive">
                <TriangleAlert data-icon="inline-start" />
                {skill}
              </Badge>
            ))}
          </div>
        ) : (
          <span>—</span>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={!application.cvId}
          onClick={onOpenCheck}
        >
          Check skills
        </Button>
      </div>
    </DetailField>
  )
}

/**
 * Company/Position/Location/Job type/Working type/Deadline — the structured
 * job metadata fields, shared by both `variant`s' sidebar `dl`.
 */
function JobMetaFields({ application }: { application: DbApplication }) {
  return (
    <>
      <DetailField label="Company">{application.company ?? "—"}</DetailField>
      <DetailField label="Position">{application.position ?? "—"}</DetailField>
      <DetailField label="Location">{application.location ?? "—"}</DetailField>
      <DetailField label="Job type">
        {application.jobType ? JOB_TYPE_LABEL[application.jobType] : "—"}
      </DetailField>
      <DetailField label="Working type">
        {application.workType ? WORK_TYPE_LABEL[application.workType] : "—"}
      </DetailField>
      <DetailField label="Deadline">{formatDeadline(application.deadline)}</DetailField>
    </>
  )
}

/** Note/Tags — private metadata, shared by both `variant`s' sidebar `dl`. */
function NoteAndTagsFields({ application }: { application: DbApplication }) {
  return (
    <>
      <DetailField label="Note">
        <span className="whitespace-pre-wrap">{application.note ?? "—"}</span>
      </DetailField>
      <DetailField label="Tags">
        {application.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {application.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          "—"
        )}
      </DetailField>
    </>
  )
}

function StatusSelectField({
  application,
  gateReason,
  onStatusChange,
}: {
  application: DbApplication
  /** Why leaving `draft` is blocked right now — `null` when it isn't. */
  gateReason: "missing-cv" | "loading" | null
  onStatusChange: (next: GlobalApplicationStatus) => void
}) {
  return (
    <Field>
      <FieldLabel htmlFor="application-status">Status</FieldLabel>
      <Select
        items={GLOBAL_APPLICATION_STATUSES.map((status) => ({ value: status, label: GLOBAL_STATUS_LABEL[status] }))}
        value={application.globalStatus}
        onValueChange={(next) => onStatusChange(next as GlobalApplicationStatus)}
      >
        <SelectTrigger id="application-status" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {GLOBAL_APPLICATION_STATUSES.map((status) => (
              <SelectItem key={status} value={status} disabled={gateReason !== null && status !== "draft"}>
                {GLOBAL_STATUS_LABEL[status]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {gateReason === "missing-cv" ? (
        <p className="text-xs text-muted-foreground">Attach a CV before changing status.</p>
      ) : null}
      {gateReason === "loading" ? (
        <p className="text-xs text-muted-foreground">Loading your CVs — status change will be available shortly.</p>
      ) : null}
    </Field>
  )
}

/**
 * The Job Detail tab's content. In the drawer (`variant="sheet"`, the
 * default — narrow, no room to spare) every field stacks in one column. On
 * the full page (`variant="page"`) there's room for two: Vacancy detail and
 * Cover letter — the fields that run long — get the main column, everything
 * else (Source, Apply via, CV, Status) moves into a narrower sidebar column.
 */
function JobDetailTab({
  application,
  cv,
  gateReason,
  onStatusChange,
  onOpenSkillsCheck,
  variant,
}: {
  application: DbApplication
  cv: DbCv | undefined
  gateReason: "missing-cv" | "loading" | null
  onStatusChange: (next: GlobalApplicationStatus) => void
  onOpenSkillsCheck: () => void
  variant: "sheet" | "page"
}) {
  if (variant === "page") {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <dl className="flex flex-col gap-3 text-sm">
          <DetailField label="Vacancy detail">
            <VacancyDetailContent html={application.vacancyDetail} />
          </DetailField>
          <DetailField label="Cover letter">
            <VacancyDetailContent html={application.coverLetter} />
          </DetailField>
        </dl>

        <div className="flex flex-col gap-4 border rounded-xl p-4">
          <dl className="flex flex-col gap-3 text-sm">
            <JobMetaFields application={application} />
            <SourceUrlField application={application} />
            <DetailField label="Apply via">{application.applyVia ?? "—"}</DetailField>
            <DetailField label="CV">{cv?.name ?? "—"}</DetailField>
            <MissingSkillsField application={application} onOpenCheck={onOpenSkillsCheck} />
            <NoteAndTagsFields application={application} />
          </dl>
          <StatusSelectField
            application={application}
            gateReason={gateReason}
            onStatusChange={onStatusChange}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="flex flex-col gap-3 text-sm">
        <JobMetaFields application={application} />
        <SourceUrlField application={application} />
        <DetailField label="Vacancy detail">
          <VacancyDetailContent html={application.vacancyDetail} />
        </DetailField>
        <DetailField label="Cover letter">
          <VacancyDetailContent html={application.coverLetter} />
        </DetailField>
        <DetailField label="Apply via">{application.applyVia ?? "—"}</DetailField>
        <DetailField label="CV">{cv?.name ?? "—"}</DetailField>
        <MissingSkillsField application={application} onOpenCheck={onOpenSkillsCheck} />
        <NoteAndTagsFields application={application} />
      </dl>
      <StatusSelectField
        application={application}
        gateReason={gateReason}
        onStatusChange={onStatusChange}
      />
    </div>
  )
}

/**
 * Job Detail / CV Preview / Timeline tabs, plus the status `Select` (with
 * the once-only freeze confirmation). Shared by the drawer
 * (`ApplicationDetailSheet`, `variant="sheet"`) and the full-page view
 * (`ApplicationDetailPage`, `variant="page"`) so the two never drift apart —
 * `variant` only changes the Job Detail tab's column layout and whether this
 * component renders its own Badge/Edit header row (the page builds its own
 * header instead, with the back button and title alongside the badge).
 */
export function ApplicationDetailView({
  application,
  onEdit,
  variant = "sheet",
}: {
  application: DbApplication
  onEdit: (application: DbApplication) => void
  variant?: "sheet" | "page"
}) {
  const applicationStore = useApplicationStore()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()

  const freezeDialog = useDialogSearchParams()
  const pendingStatus =
    freezeDialog.dialog === "freeze-cv"
      ? (freezeDialog.get("status") as GlobalApplicationStatus | null)
      : null
  const [freezing, setFreezing] = React.useState(false)
  // Distinct from the page-level `tab` param (List/Kanban/Archive on
  // `/applications`) so the Sheet's nested tabs don't collide with it.
  const [detailTab, setDetailTab] = useTabSearchParam("detailTab", "job-detail")

  const cv = application.cvId ? findCv(personaStore, application.cvId) : undefined
  const resolvedCv = resolveApplicationCv(application, personaStore, inventoryStore)

  const skillsCheckDialog = useDialogSearchParams()
  const [requiredSkillsInput, setRequiredSkillsInput] = React.useState(
    application.requiredSkillsInput ?? ""
  )
  const [missingSkillsResult, setMissingSkillsResult] = React.useState<string[] | null>(
    application.missingSkills
  )
  const [savingSkillsCheck, setSavingSkillsCheck] = React.useState(false)
  const availableSkills = resolvedCv ? skillTitlesOf(resolvedCv.document) : []

  function openSkillsCheck() {
    setRequiredSkillsInput(application.requiredSkillsInput ?? "")
    setMissingSkillsResult(application.missingSkills)
    skillsCheckDialog.open("skills-check")
  }

  async function saveSkillsCheck() {
    setSavingSkillsCheck(true)
    try {
      await updateApplication(applicationStore, application.id, {
        requiredSkillsInput: requiredSkillsInput.trim() || null,
        missingSkills: missingSkillsResult && missingSkillsResult.length > 0 ? missingSkillsResult : null,
      })
      skillsCheckDialog.close()
    } finally {
      setSavingSkillsCheck(false)
    }
  }

  async function handleStatusChange(next: GlobalApplicationStatus) {
    if (next === application.globalStatus) return

    // Mirrors `setGlobalApplicationStatus`'s own once-only freeze condition
    // exactly — only this specific transition shows the confirmation.
    if (application.globalStatus === "draft" && next !== "draft") {
      freezeDialog.open("freeze-cv", { status: next })
      return
    }

    await setGlobalApplicationStatus(applicationStore, personaStore, inventoryStore, application.id, next)
  }

  async function confirmFreeze() {
    const status = freezeDialog.get("status") as GlobalApplicationStatus | null
    if (!status) return

    setFreezing(true)
    try {
      await setGlobalApplicationStatus(
        applicationStore,
        personaStore,
        inventoryStore,
        application.id,
        status
      )
      freezeDialog.close(["status"])
    } finally {
      setFreezing(false)
    }
  }

  const storesLoading = personaStore.loading || inventoryStore.loading
  const gateReason: "missing-cv" | "loading" | null =
    application.globalStatus !== "draft"
      ? null
      : !application.cvId
        ? "missing-cv"
        : storesLoading
          ? "loading"
          : null

  return (
    <>
      <div className="flex flex-col gap-4">
        {variant === "sheet" ? (
          <div className="flex items-center justify-between">
            <Badge variant="secondary">{GLOBAL_STATUS_LABEL[application.globalStatus]}</Badge>
            <Button variant="outline" size="sm" onClick={() => onEdit(application)}>
              <PencilIcon data-icon="inline-start" />
              Edit
            </Button>
          </div>
        ) : null}

        <Tabs value={detailTab} onValueChange={setDetailTab}>
          <TabsList variant="line" className="w-fit">
            <TabsTrigger value="job-detail">Job Detail</TabsTrigger>
            <TabsTrigger value="cv-preview">CV Preview</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="job-detail" className="pt-4">
            <JobDetailTab
              application={application}
              cv={cv}
              gateReason={gateReason}
              onStatusChange={handleStatusChange}
              onOpenSkillsCheck={openSkillsCheck}
              variant={variant}
            />
          </TabsContent>

          <TabsContent value="cv-preview" className="pt-4">
            {resolvedCv ? (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    {resolvedCv.document.personaName} - {resolvedCv.template.name}
                    {resolvedCv.kind === "frozen" ? " (frozen)" : null}
                  </span>
                  <Button
                    variant="link"
                    className="h-auto p-0"
                    render={<Link to={`/applications/${application.id}/cv`} />}
                    nativeButton={false}
                  >
                    Open print view
                  </Button>
                </div>
                <div className="overflow-auto rounded-xl bg-muted p-4">
                  <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
                    <ResumeRender
                      document={resolvedCv.document}
                      templateId={resolvedCv.template.id}
                      definition={resolvedCv.template.definition}
                      settings={
                        resolvedCv.kind === "frozen"
                          ? resolvedCv.snapshot.templateSettings
                          : resolvedCv.cv.templateSettings
                      }
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Empty className="min-h-72 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <FileTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>No CV attached</EmptyTitle>
                  <EmptyDescription>
                    Attach a CV to this application to preview it here.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </TabsContent>

          <TabsContent value="timeline" className="pt-4">
            <TimelineTab application={application} />
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog
        open={pendingStatus !== null}
        onOpenChange={(next) => !next && freezeDialog.close(["status"])}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Freeze the attached CV?</AlertDialogTitle>
            <AlertDialogDescription>
              This freezes a copy of the attached CV as it looks right now. Later edits to the CV
              won&apos;t affect this application.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => freezeDialog.close(["status"])}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={freezing} onClick={confirmFreeze}>
              {freezing ? "Freezing…" : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SkillsCheckDialog
        open={skillsCheckDialog.dialog === "skills-check"}
        onOpenChange={(next) => !next && skillsCheckDialog.close()}
        value={requiredSkillsInput}
        onValueChange={setRequiredSkillsInput}
        result={missingSkillsResult}
        onCheck={() =>
          setMissingSkillsResult(findMissingSkills(requiredSkillsInput, availableSkills))
        }
        disabledReason={!resolvedCv ? "Select a CV first" : undefined}
        extraFooter={
          <Button size="sm" disabled={savingSkillsCheck} onClick={saveSkillsCheck}>
            {savingSkillsCheck ? "Saving…" : "Save"}
          </Button>
        }
      />
    </>
  )
}
