import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NoteTagsCollapsible } from "@/components/inventory/note-tags-collapsible"

export type PersonaFormFields = {
  name: string
  note: string | null
  tags: string[]
}

/**
 * Name, note, and tags in one dialog — the fields a Persona itself owns
 * (never its content, which lives in the section pickers). One component,
 * three callers: New Persona, Edit, Duplicate — each just supplies different
 * initial values and a different `onSubmit`.
 */
export function PersonaFormDialog({
  open,
  onOpenChange,
  title,
  confirmLabel,
  initialName = "",
  initialNote = null,
  initialTags = [],
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  confirmLabel: string
  initialName?: string
  initialNote?: string | null
  initialTags?: string[]
  onSubmit: (fields: PersonaFormFields) => Promise<void>
}) {
  const [name, setName] = React.useState(initialName)
  const [note, setNote] = React.useState(initialNote)
  const [tags, setTags] = React.useState(initialTags)
  const [saving, setSaving] = React.useState(false)

  // Seeded only on the open transition, adjusted during render — same
  // pattern as PoolPickerDialog's selection seeding.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName(initialName)
      setNote(initialNote)
      setTags(initialTags)
    }
  }

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      await onSubmit({ name: trimmed, note, tags })
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
        <DialogBody className="flex flex-col gap-4">
          <Field>
            <Input
              placeholder="Persona Name"
              id="persona-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSubmit()
              }}
            />
          </Field>
          <NoteTagsCollapsible
            note={note}
            onNoteChange={setNote}
            tags={tags}
            onTagsChange={setTags}
          />
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
          <Button
            size="sm"
            disabled={saving || !name.trim()}
            onClick={handleSubmit}
          >
            {saving ? "Saving…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
