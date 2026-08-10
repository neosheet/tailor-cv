import * as React from "react"
import { CalendarIcon, XIcon } from "lucide-react"
import { format } from "date-fns"

import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

/**
 * A single full-day date field — a trimmed sibling of
 * `src/components/inventory/partial-date-picker.tsx` without its year/month/
 * day precision toggle, since every use of this field is always a specific
 * day. Controlled against a plain `yyyy-MM-dd` string (never a JS `Date` in
 * storage), matching that component's convention. Originally built for
 * `Application.deadline`; also reused as-is for the stage form's
 * Scheduled/Completed fields (`label` distinguishes them), so its label text
 * is a prop rather than hardcoded.
 */
export function DeadlineDatePicker({
  value,
  onValueChange,
  id,
  label = "Deadline",
}: {
  value: string | null
  onValueChange: (iso: string | null) => void
  id?: string
  label?: string
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const [year, month, day] = value.split("-").map(Number)
    if (!year || !month || !day) return undefined
    return new Date(year, month - 1, day)
  }, [value])

  const formattedDate = selected ? format(selected, "PP") : null

  function handleSelect(date: Date | undefined) {
    onValueChange(date ? format(date, "yyyy-MM-dd") : null)
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId} className="sr-only">
        {label}
      </FieldLabel>
      <Popover>
        <InputGroup>
          <InputGroupAddon>
            <CalendarIcon />
          </InputGroupAddon>
          <PopoverTrigger
            render={
              <button
                id={inputId}
                type="button"
                data-slot="input-group-control"
                className="flex h-full flex-1 items-center bg-transparent pl-1.5 text-left text-sm outline-none"
              />
            }
          >
            <span className={cn(!formattedDate && "text-muted-foreground")}>
              {formattedDate ?? "Pick a date"}
            </span>
          </PopoverTrigger>
          {value && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label={`Clear ${label.toLowerCase()}`}
                size="icon-xs"
                onClick={() => onValueChange(null)}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <PopoverContent className="w-auto">
          <Calendar mode="single" captionLayout="dropdown" selected={selected} onSelect={handleSelect} />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
