import * as React from "react"
import { UsersIcon, XIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"

/**
 * Free-text chip list for a stage's interviewer names. Unlike `TagInput`/
 * `SkillLinkInput`, there's no registry to suggest from — every name is
 * whatever the user typed, once — so this is a plain hand-composed
 * `Field`/`InputGroup`/`Input` + `Badge` chips component rather than a
 * `Combobox` usage (the `Combobox` primitives all exist to manage a
 * *suggestion list*, which doesn't apply here). Controlled against
 * `string[]`.
 */
export function InterviewerNamesInput({
  value,
  onValueChange,
  id,
}: {
  value: string[]
  onValueChange: (names: string[]) => void
  id?: string
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId
  const [input, setInput] = React.useState("")

  // Enter or comma commits the current text as a new chip. Silently no-ops
  // on empty/whitespace-only input or a case-insensitive duplicate — nothing
  // in this field warrants an error message, it's just not added.
  function commit() {
    const trimmed = input.trim()
    setInput("")

    if (!trimmed) {
      return
    }

    const isDuplicate = value.some(
      (name) => name.toLowerCase() === trimmed.toLowerCase()
    )
    if (isDuplicate) {
      return
    }

    onValueChange([...value, trimmed])
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      commit()
      return
    }

    // Backspace on an already-empty input pops the last chip instead of
    // doing nothing — mirrors `ComboboxChipsInput`'s remove-last convention.
    if (event.key === "Backspace" && input === "" && value.length > 0) {
      onValueChange(value.slice(0, -1))
    }
  }

  function removeName(name: string) {
    onValueChange(value.filter((existing) => existing !== name))
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId} className="sr-only">
        Interviewers
      </FieldLabel>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((name) => (
            <Badge key={name} variant="secondary" className="gap-1 pr-1">
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => removeName(name)}
                className="rounded-full opacity-50 hover:opacity-100"
              >
                <XIcon className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <InputGroup>
        <InputGroupAddon>
          <UsersIcon />
        </InputGroupAddon>
        <InputGroupInput
          id={inputId}
          placeholder="Add an interviewer…"
          aria-label="Interviewers"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </InputGroup>
    </Field>
  )
}
