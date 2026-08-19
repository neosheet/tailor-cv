import * as React from "react"
import { BriefcaseIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import { DeadlineDatePicker } from "@/components/applications/deadline-date-picker"
import { VacancyDetailEditor } from "@/components/applications/vacancy-detail-editor"
import type { ApplicationFormFields } from "@/lib/application"
import { APPLICATION_JOB_TYPES, JOB_TYPE_LABEL } from "@/lib/application-job-type"
import { APPLICATION_WORK_TYPES, WORK_TYPE_LABEL } from "@/lib/application-work-type"
import { isEmptyHtml } from "@/lib/quill-html"
import type { ApplicationJobType, ApplicationWorkType } from "@/mocks/types"

/** Sentinel for the job/work type selects' unset option. */
const NO_VALUE = "none"

/**
 * Title, Company/Position/Location, Job type/Working type/Deadline, URL,
 * Vacancy detail, Cover letter, and Apply via — the fields an application
 * itself owns. CV setup is lazy and lives on the application detail view's
 * CV tab instead (docs/specs/15-cv-embedded-in-applications.md), so there's
 * no CV picker here. One component, used both for New Application and for
 * editing an existing one from the detail Sheet (`ApplicationDetailSheet`
 * opens this in edit mode rather than duplicating the field markup inline —
 * see that file's comment for why). Styled to match the rest of the
 * dialogs: an `InputGroup` for the title (optional — auto-derived from
 * Company/Position when left blank), plain `Field`s below including the
 * required Company and Position fields.
 */
export function ApplicationFormDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialTitle = "",
  initialCompany = "",
  initialPosition = "",
  initialLocation = "",
  initialJobType = null,
  initialWorkType = null,
  initialDeadline = null,
  initialSourceUrl = "",
  initialVacancyDetail = "",
  initialCoverLetter = "",
  initialApplyVia = "",
  initialNote = null,
  initialTags = [],
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  confirmLabel: string
  initialTitle?: string
  initialCompany?: string
  initialPosition?: string
  initialLocation?: string
  initialJobType?: ApplicationJobType | null
  initialWorkType?: ApplicationWorkType | null
  initialDeadline?: string | null
  initialSourceUrl?: string
  initialVacancyDetail?: string
  initialCoverLetter?: string
  initialApplyVia?: string
  initialNote?: string | null
  initialTags?: string[]
  onSubmit: (fields: ApplicationFormFields) => Promise<void>
}) {
  const [applicationTitle, setApplicationTitle] = React.useState(initialTitle)
  const [company, setCompany] = React.useState(initialCompany)
  const [position, setPosition] = React.useState(initialPosition)
  const [location, setLocation] = React.useState(initialLocation)
  const [jobType, setJobType] = React.useState(initialJobType ?? NO_VALUE)
  const [workType, setWorkType] = React.useState(initialWorkType ?? NO_VALUE)
  const [deadline, setDeadline] = React.useState(initialDeadline)
  const [sourceUrl, setSourceUrl] = React.useState(initialSourceUrl)
  const [vacancyDetail, setVacancyDetail] = React.useState(initialVacancyDetail)
  const [coverLetter, setCoverLetter] = React.useState(initialCoverLetter)
  const [applyVia, setApplyVia] = React.useState(initialApplyVia)
  const [note, setNote] = React.useState(initialNote)
  const [tags, setTags] = React.useState(initialTags)
  const [saving, setSaving] = React.useState(false)

  // Seeded only on the open transition, adjusted during render — same
  // pattern as CvFormDialog's `wasOpen`.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setApplicationTitle(initialTitle)
      setCompany(initialCompany)
      setPosition(initialPosition)
      setLocation(initialLocation)
      setJobType(initialJobType ?? NO_VALUE)
      setWorkType(initialWorkType ?? NO_VALUE)
      setDeadline(initialDeadline)
      setSourceUrl(initialSourceUrl)
      setVacancyDetail(initialVacancyDetail)
      setCoverLetter(initialCoverLetter)
      setApplyVia(initialApplyVia)
      setNote(initialNote)
      setTags(initialTags)
    }
  }

  const jobTypeOptions = [
    { value: NO_VALUE, label: "Not specified" },
    ...APPLICATION_JOB_TYPES.map((value) => ({ value, label: JOB_TYPE_LABEL[value] })),
  ]
  const workTypeOptions = [
    { value: NO_VALUE, label: "Not specified" },
    ...APPLICATION_WORK_TYPES.map((value) => ({ value, label: WORK_TYPE_LABEL[value] })),
  ]

  const canSubmit = company.trim() !== "" && position.trim() !== ""

  async function handleSubmit() {
    const trimmedCompany = company.trim()
    const trimmedPosition = position.trim()
    if (!trimmedCompany || !trimmedPosition) return

    const trimmedTitle =
      applicationTitle.trim() || `${trimmedPosition} at ${trimmedCompany}`

    setSaving(true)
    try {
      await onSubmit({
        title: trimmedTitle,
        company: trimmedCompany,
        position: trimmedPosition,
        location: location.trim() || null,
        jobType: jobType === NO_VALUE ? null : (jobType as ApplicationJobType),
        workType: workType === NO_VALUE ? null : (workType as ApplicationWorkType),
        deadline,
        sourceUrl: sourceUrl.trim() || null,
        vacancyDetail: isEmptyHtml(vacancyDetail) ? null : vacancyDetail,
        coverLetter: isEmptyHtml(coverLetter) ? null : coverLetter,
        applyVia: applyVia.trim() || null,
        note,
        tags,
      })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 pt-2 -mb-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="application-title" className="sr-only">
                Title
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <BriefcaseIcon />
                </InputGroupAddon>
                <InputGroupInput
                  id="application-title"
                  placeholder="Auto-generated from position and company if left blank"
                  autoFocus
                  value={applicationTitle}
                  onChange={(event) => setApplicationTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit()
                  }}
                />
              </InputGroup>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="application-company">
                  Company <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="application-company"
                  placeholder="Acme Inc."
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="application-position">
                  Position <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="application-position"
                  placeholder="Senior Engineer"
                  value={position}
                  onChange={(event) => setPosition(event.target.value)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="application-location">Location</FieldLabel>
                <Input
                  id="application-location"
                  placeholder="Jakarta, Indonesia"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="application-deadline">Deadline</FieldLabel>
                <DeadlineDatePicker
                  id="application-deadline"
                  value={deadline}
                  onValueChange={setDeadline}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="application-job-type">Job type</FieldLabel>
                <Select
                  items={jobTypeOptions}
                  value={jobType}
                  onValueChange={(next) => setJobType(next as string)}
                >
                  <SelectTrigger id="application-job-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {jobTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="application-work-type">Working type</FieldLabel>
                <Select
                  items={workTypeOptions}
                  value={workType}
                  onValueChange={(next) => setWorkType(next as string)}
                >
                  <SelectTrigger id="application-work-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {workTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="application-source">URL</FieldLabel>
              <Input
                id="application-source"
                type="url"
                placeholder="Link to the job listing"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="application-vacancy-detail">Vacancy detail</FieldLabel>
              <VacancyDetailEditor
                id="application-vacancy-detail"
                value={vacancyDetail}
                onValueChange={setVacancyDetail}
                placeholder="Paste the job description or notes"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="application-cover-letter">Cover letter</FieldLabel>
              <VacancyDetailEditor
                id="application-cover-letter"
                value={coverLetter}
                onValueChange={setCoverLetter}
                placeholder="Write or paste your cover letter"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="application-apply-via">Apply via</FieldLabel>
              <Input
                id="application-apply-via"
                placeholder="Email, URL, referral…"
                value={applyVia}
                onChange={(event) => setApplyVia(event.target.value)}
              />
            </Field>
          </FieldGroup>

          {/* Secondary area: note/tags aren't part of the application's
              identity, so they get their own muted panel — same treatment as
              CvFormDialog's/ItemDialog's note/tags section. */}
          <FieldGroup className="-mx-4 mt-4 w-auto border-t bg-muted/50 px-4 py-4">
            <NoteInput value={note} onValueChange={setNote} />
            <TagInput value={tags} onValueChange={setTags} />
          </FieldGroup>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button size="sm" disabled={saving || !canSubmit} onClick={handleSubmit}>
            {saving ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
