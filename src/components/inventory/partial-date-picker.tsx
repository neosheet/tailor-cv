import { XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const CURRENT_YEAR = new Date().getFullYear()
const EARLIEST_YEAR = 1950
const LATEST_YEAR = CURRENT_YEAR + 6
const YEARS = Array.from(
  { length: LATEST_YEAR - EARLIEST_YEAR + 1 },
  (_, index) => LATEST_YEAR - index
)

/** Partial-ISO string (`"2014"` or `"2014-06"`) -> its year/month parts. */
function parseValue(value: string | null): { year: string; month: string } {
  const [year = "", month = ""] = (value ?? "").split("-")
  return { year, month }
}

/**
 * Shared date field for every pool's add/edit form. Controlled against the
 * app's partial-ISO string shape (`"2014"` or `"2014-06"`, spec 02 lines
 * 133-138) — month and year only, no day-of-month is captured. Two plain
 * `Select`s rather than a calendar popover, since callers never need to pick
 * a specific day.
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
  const { year, month } = parseValue(value)

  function handleMonthChange(nextMonth: string | null) {
    if (!year || !nextMonth) return
    onValueChange(`${year}-${nextMonth}`)
  }

  function handleYearChange(nextYear: string | null) {
    if (!nextYear) return
    onValueChange(month ? `${nextYear}-${month}` : nextYear)
  }

  return (
    <Field>
      <FieldLabel htmlFor={id} className="sr-only">
        Date
      </FieldLabel>
      <div className="flex items-center gap-2">
        <Select
          value={month}
          onValueChange={handleMonthChange}
          disabled={!year}
        >
          <SelectTrigger id={id} className="flex-1">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {MONTHS.map((label, index) => (
                <SelectItem
                  key={label}
                  value={String(index + 1).padStart(2, "0")}
                >
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={handleYearChange}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Clear date"
            onClick={() => onValueChange(null)}
          >
            <XIcon />
          </Button>
        )}
      </div>
    </Field>
  )
}
