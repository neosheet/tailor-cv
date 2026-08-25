import * as React from "react"
import { FileDownIcon, PencilIcon, PrinterIcon, TriangleAlert } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useReactToPrint } from "react-to-print"

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
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
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
import { PersonaFieldTree } from "@/components/cv/persona-field-tree"
import { ResumeRender } from "@/components/cv/resume-render"
import { SkillsCheckDialog } from "@/components/skills/skills-check-dialog"
import { ApplicationCheckButton } from "@/components/applications/application-check-button"
import { ApplicationCvSetup } from "@/components/applications/application-cv-setup"
import { TimelineTab } from "@/components/applications/timeline-tab"
import { VacancyDetailContent } from "@/components/applications/vacancy-detail-content"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { useTabSearchParam } from "@/hooks/use-tab-search-param"
import { GLOBAL_APPLICATION_STATUSES, GLOBAL_STATUS_LABEL } from "@/lib/application-status"
import { JOB_TYPE_LABEL } from "@/lib/application-job-type"
import { WORK_TYPE_LABEL } from "@/lib/application-work-type"
import {
  allApplications,
  copyApplicationCvSettings,
  resolveApplicationCv,
  setApplicationCvBase,
  setGlobalApplicationStatus,
  updateApplication,
  type ResolvedApplicationCv,
} from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { buildCvSnapshot } from "@/lib/cv-snapshot"
import { downloadCvSnapshot } from "@/lib/cv-snapshot-download"
import { allTemplates, findTemplate } from "@/lib/cv-templates"
import { useInventoryStore } from "@/lib/inventory-store"
import { allPersonas } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { skillTitlesOf } from "@/lib/skill-check"
import { useSkillsCheck } from "@/hooks/use-skills-check"
import type { GlobalApplicationStatus, DbApplication } from "@/mocks/types"

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
          disabled={!application.cvPersonaId}
          onClick={onOpenCheck}
        >
          Check skills
        </Button>
      </div>
    </DetailField>
  )
}

/**
 * Company/Position/Location/Job type/Working type/Post date — the structured
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
      <DetailField label="Post date">{formatDeadline(application.deadline)}</DetailField>
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
  resolvedCv,
  gateReason,
  onStatusChange,
  onOpenSkillsCheck,
  variant,
}: {
  application: DbApplication
  resolvedCv: ResolvedApplicationCv | undefined
  gateReason: "missing-cv" | "loading" | null
  onStatusChange: (next: GlobalApplicationStatus) => void
  onOpenSkillsCheck: () => void
  variant: "sheet" | "page"
}) {
  const cvLabel = resolvedCv
    ? `${resolvedCv.document.personaName} — ${resolvedCv.template.name}`
    : "—"

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
            <DetailField label="CV">{cvLabel}</DetailField>
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
        <DetailField label="CV">{cvLabel}</DetailField>
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
 * Import CV settings dialog — the reworked Import (spec 15): copies the
 * persona/template config from another application onto this one via
 * `copyApplicationCvSettings`. Never touches the target's actual document —
 * it keeps resolving live off whichever persona ends up set. Candidates are
 * any other application with a `cvPersonaId` set, frozen or not: freezing
 * never clears `cvPersonaId`/`cvTemplateId`/`cvPersonaSettings`/
 * `cvTemplateSettings`, so a frozen application's config is just as valid a
 * source to copy from.
 */
function ImportCvSettingsDialog({
  open,
  onOpenChange,
  targetApplicationId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetApplicationId: string
}) {
  const applicationStore = useApplicationStore()
  const [sourceId, setSourceId] = React.useState("")
  const [importing, setImporting] = React.useState(false)

  const sourceOptions = allApplications(applicationStore)
    .filter((candidate) => candidate.id !== targetApplicationId && candidate.cvPersonaId !== null)
    .map((candidate) => ({ value: candidate.id, label: candidate.title }))

  async function handleImport() {
    if (!sourceId) return
    setImporting(true)
    try {
      await copyApplicationCvSettings(applicationStore, sourceId, targetApplicationId)
      onOpenChange(false)
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !importing && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import CV settings</DialogTitle>
        </DialogHeader>
        <DialogBody className="pt-2">
          {sourceOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other application has a CV to copy settings from.
            </p>
          ) : (
            <Field>
              <FieldLabel htmlFor="import-cv-source">From application</FieldLabel>
              <Select
                items={sourceOptions}
                value={sourceId}
                onValueChange={(next) => setSourceId(next as string)}
              >
                <SelectTrigger id="import-cv-source" className="w-full">
                  <SelectValue placeholder="Select an application…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {sourceOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" disabled={importing} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={importing || !sourceId} onClick={handleImport}>
            {importing ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Job Detail / CV / Timeline tabs, plus the status `Select` (with
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

  const appliedViaDialog = useDialogSearchParams("appliedVia")
  const [appliedVia, setAppliedVia] = React.useState("")
  const [savingAppliedVia, setSavingAppliedVia] = React.useState(false)
  // Distinct from the page-level `tab` param (List/Kanban/Archive on
  // `/applications`) so the Sheet's nested tabs don't collide with it.
  const [detailTab, setDetailTab] = useTabSearchParam("detailTab", "job-detail")

  const resolvedCv = resolveApplicationCv(application, personaStore, inventoryStore)
  const [importCvOpen, setImportCvOpen] = React.useState(false)

  const cvContentRef = React.useRef<HTMLDivElement>(null)
  const cvPageMargin =
    (resolvedCv
      ? resolvedCv.kind === "frozen"
        ? resolvedCv.snapshot.templateSettings.page?.margin
        : application.cvTemplateSettings.page?.margin
      : undefined) ?? resolvedCv?.template.definition.page.margin ?? 0
  const printCv = useReactToPrint({
    contentRef: cvContentRef,
    pageStyle: `
      @page {
        margin: ${cvPageMargin}pt;
      }
    `,
    documentTitle: resolvedCv
      ? `${resolvedCv.document.personaName} — ${resolvedCv.template.name}.pdf`
      : "cv.pdf",
  })

  function handleExportCv() {
    if (!resolvedCv) return
    const snapshot =
      resolvedCv.kind === "frozen"
        ? resolvedCv.snapshot
        : buildCvSnapshot(
            { name: application.title, note: null, tags: [], templateSettings: application.cvTemplateSettings },
            resolvedCv.document,
            resolvedCv.template
          )
    downloadCvSnapshot(snapshot)
  }

  const cvPersonaOptions = allPersonas(personaStore).map((persona) => ({
    value: persona.id,
    label: persona.name,
  }))
  const cvTemplateOptions = allTemplates(personaStore.cvTemplates).map((template) => ({
    value: template.id,
    label: template.name,
  }))
  const [changingCvBase, setChangingCvBase] = React.useState(false)

  async function handleCvPersonaChange(personaId: string) {
    setChangingCvBase(true)
    try {
      await setApplicationCvBase(applicationStore, application.id, personaId, application.cvTemplateId ?? "")
    } finally {
      setChangingCvBase(false)
    }
  }

  async function handleCvTemplateChange(templateId: string) {
    setChangingCvBase(true)
    try {
      const template = findTemplate(templateId, personaStore.cvTemplates)
      await setApplicationCvBase(
        applicationStore,
        application.id,
        application.cvPersonaId ?? "",
        templateId,
        template?.defaultFieldVisibility
      )
    } finally {
      setChangingCvBase(false)
    }
  }

  const skillsCheckDialog = useDialogSearchParams()
  const skillsCheck = useSkillsCheck()
  const [savingSkillsCheck, setSavingSkillsCheck] = React.useState(false)
  const availableSkills = resolvedCv ? skillTitlesOf(resolvedCv.document) : []

  function openSkillsCheck() {
    skillsCheck.reset(application.requiredSkillsInput ?? "", application.missingSkills)
    skillsCheckDialog.open("skills-check")
  }

  async function saveSkillsCheck() {
    setSavingSkillsCheck(true)
    try {
      await updateApplication(applicationStore, application.id, {
        requiredSkillsInput: skillsCheck.value.trim() || null,
        missingSkills:
          skillsCheck.result && skillsCheck.result.length > 0 ? skillsCheck.result : null,
      })
      skillsCheckDialog.close()
    } finally {
      setSavingSkillsCheck(false)
    }
  }

  async function handleStatusChange(next: GlobalApplicationStatus) {
    if (next === application.globalStatus) return

    if (next === "applied") {
      setAppliedVia(application.applyVia ?? "")
      appliedViaDialog.open("applied-via")
      return
    }

    // Mirrors `setGlobalApplicationStatus`'s own once-only freeze condition
    // exactly — only this specific transition shows the confirmation.
    if (application.globalStatus === "draft" && next !== "draft") {
      freezeDialog.open("freeze-cv", { status: next })
      return
    }

    await setGlobalApplicationStatus(applicationStore, personaStore, inventoryStore, application.id, next)
  }

  async function confirmAppliedVia() {
    setSavingAppliedVia(true)
    try {
      await setGlobalApplicationStatus(
        applicationStore,
        personaStore,
        inventoryStore,
        application.id,
        "applied"
      )
      await updateApplication(applicationStore, application.id, {
        applyVia: appliedVia.trim() || null,
      })
      appliedViaDialog.close()
    } finally {
      setSavingAppliedVia(false)
    }
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
      : !application.cvPersonaId
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
            <div className="flex items-center gap-2">
              <ApplicationCheckButton application={application} />
              <Button variant="outline" size="sm" onClick={() => onEdit(application)}>
                <PencilIcon data-icon="inline-start" />
                Edit
              </Button>
            </div>
          </div>
        ) : null}

        <Tabs value={detailTab} onValueChange={setDetailTab}>
          <TabsList variant="line" className="w-fit">
            <TabsTrigger value="job-detail">Job Detail</TabsTrigger>
            <TabsTrigger value="cv">CV</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="job-detail" className="pt-4">
            <JobDetailTab
              application={application}
              resolvedCv={resolvedCv}
              gateReason={gateReason}
              onStatusChange={handleStatusChange}
              onOpenSkillsCheck={openSkillsCheck}
              variant={variant}
            />
          </TabsContent>

          <TabsContent value="cv" className="pt-4">
            {!resolvedCv ? (
              <ApplicationCvSetup
                application={application}
                onImportClick={() => setImportCvOpen(true)}
              />
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {resolvedCv.kind === "frozen" ? (
                    <span className="text-sm text-muted-foreground">
                      {resolvedCv.document.personaName} - {resolvedCv.template.name} (frozen)
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <Select
                        items={cvPersonaOptions}
                        value={application.cvPersonaId ?? ""}
                        onValueChange={(next) => handleCvPersonaChange(next as string)}
                        disabled={changingCvBase}
                      >
                        <SelectTrigger size="sm" className="w-44">
                          <SelectValue placeholder="Persona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {cvPersonaOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <Select
                        items={cvTemplateOptions}
                        value={application.cvTemplateId ?? ""}
                        onValueChange={(next) => handleCvTemplateChange(next as string)}
                        disabled={changingCvBase}
                      >
                        <SelectTrigger size="sm" className="w-44">
                          <SelectValue placeholder="Template" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {cvTemplateOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {resolvedCv.kind === "live" ? (
                      <Button variant="outline" size="sm" onClick={() => setImportCvOpen(true)}>
                        Import CV settings
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={handleExportCv}>
                      <FileDownIcon data-icon="inline-start" />
                      Export
                    </Button>
                    <Button size="sm" onClick={printCv}>
                      <PrinterIcon data-icon="inline-start" />
                      Print
                    </Button>
                  </div>
                </div>

                {resolvedCv.kind === "frozen" ? (
                  <div className="overflow-auto rounded-xl bg-muted p-4">
                    <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
                      <ResumeRender
                        ref={cvContentRef}
                        document={resolvedCv.document}
                        templateId={resolvedCv.template.id}
                        definition={resolvedCv.template.definition}
                        settings={resolvedCv.snapshot.templateSettings}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <div className="min-h-[480px] lg:h-[720px]">
                      <PersonaFieldTree application={application} template={resolvedCv.template} />
                    </div>
                    <div className="overflow-auto rounded-xl bg-muted p-4">
                      <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
                        <ResumeRender
                          ref={cvContentRef}
                          document={resolvedCv.document}
                          templateId={resolvedCv.template.id}
                          definition={resolvedCv.template.definition}
                          settings={application.cvTemplateSettings}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
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

      <Dialog
        open={appliedViaDialog.dialog === "applied-via"}
        onOpenChange={(next) => !next && !savingAppliedVia && appliedViaDialog.close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as applied</DialogTitle>
            {application.globalStatus === "draft" ? (
              <DialogDescription>
                This freezes a copy of the attached CV as it looks right now. Later edits to the
                CV won&apos;t affect this application.
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <DialogBody className="pt-2">
            <Field>
              <FieldLabel htmlFor="applied-via-input">Applied via</FieldLabel>
              <Input
                id="applied-via-input"
                placeholder="Email, URL, referral…"
                value={appliedVia}
                onChange={(event) => setAppliedVia(event.target.value)}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              disabled={savingAppliedVia}
              onClick={() => appliedViaDialog.close()}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={savingAppliedVia} onClick={confirmAppliedVia}>
              {savingAppliedVia ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SkillsCheckDialog
        open={skillsCheckDialog.dialog === "skills-check"}
        onOpenChange={(next) => !next && skillsCheckDialog.close()}
        value={skillsCheck.value}
        onValueChange={skillsCheck.setValue}
        result={skillsCheck.result}
        onCheck={() => skillsCheck.onCheck(availableSkills)}
        disabledReason={!resolvedCv ? "Select a CV first" : undefined}
        extraFooter={
          <Button size="sm" disabled={savingSkillsCheck} onClick={saveSkillsCheck}>
            {savingSkillsCheck ? "Saving…" : "Save"}
          </Button>
        }
      />

      <ImportCvSettingsDialog
        open={importCvOpen}
        onOpenChange={setImportCvOpen}
        targetApplicationId={application.id}
      />
    </>
  )
}
