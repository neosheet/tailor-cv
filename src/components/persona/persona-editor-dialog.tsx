import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import { PersonaEditorPanel } from "@/components/persona/persona-editor-panel"
import { createPersona, findPersona, type DbPersona } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"

/**
 * Popup wrapper around `PersonaEditorPanel` for the two places a Persona
 * needs editing without leaving an Application's CV tab: creating one from
 * scratch (`mode="create"`, an inline name/note/tags step first, same field
 * pattern as `PersonaFormDialog`) and editing an existing one in place
 * (`mode="edit"`). See docs/specs/16-inline-persona-editing-in-cv-tab.md and
 * docs/plans/18-inline-persona-editing-in-cv-tab.md (Phase 2).
 */
export function PersonaEditorDialog({
  open,
  onOpenChange,
  mode,
  personaId,
  onPersonaCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  personaId?: string
  onPersonaCreated?: (persona: DbPersona) => void
}) {
  const personaStore = usePersonaStore()
  const [createdId, setCreatedId] = React.useState<string | null>(null)

  // Seeded only on the open transition, adjusted during render — same
  // pattern as PersonaFormDialog's `wasOpen` seeding.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCreatedId(null)
    }
  }

  const effectiveId = mode === "edit" ? personaId : createdId
  const effectivePersona = effectiveId
    ? findPersona(personaStore, effectiveId)
    : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {effectivePersona ? effectivePersona.name : "Create Persona"}
          </DialogTitle>
        </DialogHeader>
        {effectiveId ? (
          <DialogBody>
            <PersonaEditorPanel
              personaId={effectiveId}
              dialogParamPrefix="persona"
            />
          </DialogBody>
        ) : (
          <CreatePersonaStep
            onCreated={(persona) => {
              setCreatedId(persona.id)
              onPersonaCreated?.(persona)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Inline name/note/tags step — same fields `PersonaFormDialog` uses, minus its dialog chrome (this is already inside one). */
function CreatePersonaStep({
  onCreated,
}: {
  onCreated: (persona: DbPersona) => void
}) {
  const personaStore = usePersonaStore()
  const [name, setName] = React.useState("")
  const [note, setNote] = React.useState<string | null>(null)
  const [tags, setTags] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      const persona = await createPersona(personaStore, {
        name: trimmed,
        note,
        tags,
      })
      onCreated(persona)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DialogBody className="flex flex-col gap-4">
      <Field>
        <Input
          placeholder="Persona Name"
          id="persona-name"
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleCreate()
          }}
        />
      </Field>
      <NoteInput value={note} onValueChange={setNote} />
      <TagInput value={tags} onValueChange={setTags} />
      <div>
        <Button disabled={saving || !name.trim()} onClick={handleCreate}>
          {saving ? "Creating…" : "Create"}
        </Button>
      </div>
    </DialogBody>
  )
}
