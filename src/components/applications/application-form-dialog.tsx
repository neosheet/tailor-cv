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
import { Textarea } from "@/components/ui/textarea"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import type { ApplicationFormFields } from "@/lib/application"

/** Sentinel for the CV select's "no CV" option — `Select` needs a string value, `cvId` is `string | null`. */
const NO_CV = "none"

/**
 * Title, Source, Vacancy detail, Apply via, and a CV picker — the fields an
 * application itself owns. One component, used both for New Application and
 * for editing an existing one from the detail Sheet (`ApplicationDetailSheet`
 * opens this in edit mode rather than duplicating the field markup inline —
 * see that file's comment for why). Styled to match `CvFormDialog`: an
 * `InputGroup` for the primary/required field, plain `Field`s below.
 */
export function ApplicationFormDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialTitle = "",
  initialSourceUrl = "",
  initialVacancyDetail = "",
  initialApplyVia = "",
  initialCvId = null,
  initialNote = null,
  initialTags = [],
  cvOptions,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  confirmLabel: string
  initialTitle?: string
  initialSourceUrl?: string
  initialVacancyDetail?: string
  initialApplyVia?: string
  initialCvId?: string | null
  initialNote?: string | null
  initialTags?: string[]
  cvOptions: { value: string; label: string }[]
  onSubmit: (fields: ApplicationFormFields) => Promise<void>
}) {
  const [applicationTitle, setApplicationTitle] = React.useState(initialTitle)
  const [sourceUrl, setSourceUrl] = React.useState(initialSourceUrl)
  const [vacancyDetail, setVacancyDetail] = React.useState(initialVacancyDetail)
  const [applyVia, setApplyVia] = React.useState(initialApplyVia)
  const [cvId, setCvId] = React.useState(initialCvId ?? NO_CV)
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
      setSourceUrl(initialSourceUrl)
      setVacancyDetail(initialVacancyDetail)
      setApplyVia(initialApplyVia)
      setCvId(initialCvId ?? NO_CV)
      setNote(initialNote)
      setTags(initialTags)
    }
  }

  const cvSelectOptions = [{ value: NO_CV, label: "No CV" }, ...cvOptions]

  const canSubmit = applicationTitle.trim() !== ""

  async function handleSubmit() {
    const trimmed = applicationTitle.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      await onSubmit({
        title: trimmed,
        sourceUrl: sourceUrl.trim() || null,
        vacancyDetail: vacancyDetail.trim() || null,
        applyVia: applyVia.trim() || null,
        cvId: cvId === NO_CV ? null : cvId,
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
      <DialogContent className="sm:max-w-md">
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
                  placeholder="Senior Engineer @ Acme"
                  autoFocus
                  value={applicationTitle}
                  onChange={(event) => setApplicationTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit()
                  }}
                />
              </InputGroup>
            </Field>
            <Field>
              <FieldLabel htmlFor="application-source">Source</FieldLabel>
              <Input
                id="application-source"
                placeholder="Where you found the listing"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="application-vacancy-detail">Vacancy detail</FieldLabel>
              <Textarea
                id="application-vacancy-detail"
                placeholder="Paste the job description or notes"
                value={vacancyDetail}
                onChange={(event) => setVacancyDetail(event.target.value)}
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
            <Field>
              <FieldLabel htmlFor="application-cv">CV</FieldLabel>
              <Select
                items={cvSelectOptions}
                value={cvId}
                onValueChange={(next) => setCvId(next as string)}
              >
                <SelectTrigger id="application-cv" className="w-full">
                  <SelectValue placeholder="Select a CV…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {cvSelectOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
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
