import * as React from "react"
import { FileTextIcon } from "lucide-react"

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
import type { CvFormFields } from "@/lib/cv"

/**
 * Name, Persona, Template, note, and tags in one dialog — the fields a CV
 * itself owns. One component, three callers: New CV, Edit, Duplicate — each
 * just supplies different initial values and a different `onSubmit`. Styled
 * to match `ItemDialog`: `InputGroup` fields up top, note/tags in a muted
 * panel below since they're metadata about the CV rather than its identity.
 */
export function CvFormDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialName = "",
  initialPersonaId = "",
  initialTemplateId = "",
  initialNote = null,
  initialTags = [],
  personaOptions,
  templateOptions,
  frozen = false,
  onSubmit,
  onSubmitFrozen,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  confirmLabel: string
  initialName?: string
  initialPersonaId?: string
  initialTemplateId?: string
  initialNote?: string | null
  initialTags?: string[]
  personaOptions: { value: string; label: string }[]
  templateOptions: { value: string; label: string }[]
  /**
   * True for an imported (snapshot) CV — there's no Persona backing it, so
   * the Persona/Template selects are hidden entirely (nothing to
   * reassign; a fresh import, not this dialog, changes a frozen CV's
   * content). See docs/specs/09-cv-export-import.md.
   */
  frozen?: boolean
  onSubmit: (fields: CvFormFields) => Promise<void>
  /** Used instead of `onSubmit` when `frozen` — only name/note/tags are editable. */
  onSubmitFrozen?: (fields: { name: string; note: string | null; tags: string[] }) => Promise<void>
}) {
  const [name, setName] = React.useState(initialName)
  const [personaId, setPersonaId] = React.useState(initialPersonaId)
  const [templateId, setTemplateId] = React.useState(initialTemplateId)
  const [note, setNote] = React.useState(initialNote)
  const [tags, setTags] = React.useState(initialTags)
  const [saving, setSaving] = React.useState(false)

  // Seeded only on the open transition, adjusted during render — same
  // pattern as PersonaFormDialog / PoolPickerDialog's selection seeding.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(initialName)
      setPersonaId(initialPersonaId || (personaOptions[0]?.value ?? ""))
      setTemplateId(initialTemplateId || (templateOptions[0]?.value ?? ""))
      setNote(initialNote)
      setTags(initialTags)
    }
  }

  const canSubmit = frozen
    ? name.trim() !== ""
    : name.trim() !== "" && personaId !== "" && templateId !== ""

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!frozen && (!personaId || !templateId)) return

    setSaving(true)
    try {
      if (frozen) {
        await onSubmitFrozen?.({ name: trimmed, note, tags })
      } else {
        await onSubmit({ name: trimmed, personaId, templateId, note, tags })
      }
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
              <FieldLabel htmlFor="cv-name" className="sr-only">
                CV Name
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <FileTextIcon />
                </InputGroupAddon>
                <InputGroupInput
                  id="cv-name"
                  placeholder="CV Name"
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSubmit()
                  }}
                />
              </InputGroup>
            </Field>
            {frozen ? null : (
              <>
                <Field>
                  <FieldLabel htmlFor="cv-persona">Persona</FieldLabel>
                  <Select
                    items={personaOptions}
                    value={personaId}
                    onValueChange={(next) => setPersonaId(next as string)}
                  >
                    <SelectTrigger id="cv-persona" className="w-full">
                      <SelectValue placeholder="Select a persona…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {personaOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="cv-template">Template</FieldLabel>
                  <Select
                    items={templateOptions}
                    value={templateId}
                    onValueChange={(next) => setTemplateId(next as string)}
                  >
                    <SelectTrigger id="cv-template" className="w-full">
                      <SelectValue placeholder="Select a template…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {templateOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}
          </FieldGroup>

          {/* Secondary area: note/tags aren't part of the CV's identity, so
              they get their own muted panel — same treatment as ItemDialog's
              note/tags section. */}
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
