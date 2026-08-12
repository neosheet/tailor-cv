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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/**
 * Collects the two fields a saved `TemplateDefinition` carries as
 * user-facing metadata (`name`, `description`) — see
 * docs/specs/13-save-as-new-template.md. Always a fresh save, so unlike
 * `CvFormDialog` there's no "initial value" to seed, only a reset on the
 * open transition.
 */
export function SaveAsNewTemplateDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (fields: { name: string; description: string }) => Promise<void>
}) {
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setName("")
      setDescription("")
    }
  }

  const canSubmit = name.trim() !== ""

  async function handleSubmit() {
    const trimmed = name.trim()
    if (!trimmed) return

    setSaving(true)
    try {
      await onSubmit({ name: trimmed, description: description.trim() })
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as new template</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 pt-2">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-template-name">Name</FieldLabel>
              <Input
                id="new-template-name"
                placeholder="Template name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSubmit()
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="new-template-description">Description</FieldLabel>
              <Textarea
                id="new-template-description"
                placeholder="What makes this layout different?"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
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
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
