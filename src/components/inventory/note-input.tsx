import * as React from "react"
import { StickyNoteIcon } from "lucide-react"

import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"

/**
 * Private note field shared by every pool's add/edit form. Controlled against
 * `string | null` — the underlying `inventory_items`/`inventory_lines` column
 * — so an emptied textarea normalizes back to `null` instead of `""`.
 */
export function NoteInput({
  value,
  onValueChange,
  id,
}: {
  value: string | null
  onValueChange: (note: string | null) => void
  id?: string
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <Field>
      <FieldLabel htmlFor={inputId} className="sr-only">
        Note
      </FieldLabel>
      <InputGroup>
        <InputGroupAddon align="block-start">
          <StickyNoteIcon />
          <InputGroupText>Note</InputGroupText>
        </InputGroupAddon>
        <InputGroupTextarea
          id={inputId}
          value={value ?? ""}
          onChange={(event) =>
            onValueChange(event.target.value === "" ? null : event.target.value)
          }
        />
      </InputGroup>
    </Field>
  )
}
