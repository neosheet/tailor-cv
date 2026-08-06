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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { formatPartialDate } from "@/components/inventory/columns"

type Precision = "year" | "month" | "day"

/** 4 chars ("2014") -> year, 7 ("2014-06") -> month, 10 ("2014-06-29") -> day. */
function precisionFromValue(value: string | null): Precision {
  if (value?.length === 4) {
    return "year"
  }

  if (value?.length === 7) {
    return "month"
  }

  return "day"
}

/**
 * A partial-ISO string can only ever resolve to *some* sensible `Date` for
 * the calendar to open on — exact day-of-month doesn't matter for a
 * year/month-only value, it just needs to land in the right vicinity.
 */
function dateFromValue(value: string | null): Date | undefined {
  if (!value) {
    return undefined
  }

  const [year, month, day] = value.split("-").map(Number)
  if (!year) {
    return undefined
  }

  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

function formatAtPrecision(date: Date, precision: Precision): string {
  if (precision === "year") {
    return format(date, "yyyy")
  }

  if (precision === "month") {
    return format(date, "yyyy-MM")
  }

  return format(date, "yyyy-MM-dd")
}

/**
 * Shared date field for every pool's add/edit form. Controlled against the
 * app's partial-ISO string shape (`"2014"`, `"2014-06"`, or `"2014-06-29"`,
 * spec 02 lines 133-138) — never a JS `Date` in storage. A 3-option
 * `ToggleGroup` picks the precision a selected calendar day is stored at.
 */
export function PartialDatePicker({
  value,
  onValueChange,
  id,
}: {
  value: string | null
  onValueChange: (iso: string | null) => void
  id?: string
}) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  const [precision, setPrecision] = React.useState<Precision>(() =>
    precisionFromValue(value)
  )

  const label = formatPartialDate(value)
  const selected = dateFromValue(value)

  function handlePrecisionChange(nextGroupValue: string[]) {
    // base-ui's ToggleGroup reports an empty array when the only pressed
    // item is clicked again — this group must always have exactly one
    // precision selected, so an empty report is ignored rather than
    // collapsing to "no precision."
    const next = nextGroupValue[0]
    if (next === "year" || next === "month" || next === "day") {
      setPrecision(next)
    }
  }

  function handleSelect(date: Date | undefined) {
    if (!date) {
      onValueChange(null)
      return
    }

    onValueChange(formatAtPrecision(date, precision))
  }

  return (
    <Field>
      <FieldLabel htmlFor={inputId} className="sr-only">
        Date
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
            <span className={cn(!label && "text-muted-foreground")}>
              {label ?? "Pick a date"}
            </span>
          </PopoverTrigger>
          {value && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                aria-label="Clear date"
                size="icon-xs"
                onClick={() => onValueChange(null)}
              >
                <XIcon />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
        <PopoverContent className="w-auto">
          <ToggleGroup
            value={[precision]}
            onValueChange={handlePrecisionChange}
            className="mb-2 justify-center"
          >
            <ToggleGroupItem value="year">Year</ToggleGroupItem>
            <ToggleGroupItem value="month">Month</ToggleGroupItem>
            <ToggleGroupItem value="day">Day</ToggleGroupItem>
          </ToggleGroup>
          <Calendar
            mode="single"
            captionLayout="dropdown"
            selected={selected}
            onSelect={handleSelect}
          />
        </PopoverContent>
      </Popover>
    </Field>
  )
}
