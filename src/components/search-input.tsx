import { SearchIcon, XIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"

/**
 * The app's one search box: magnifier, and a clear button once there's a query.
 *
 * Every list that filters uses this — Inventory pools, the tag registry — so the
 * shape stays identical wherever searching happens.
 */
export function SearchInput({
  value,
  onChange,
  label,
  className = "w-full max-w-xs",
}: {
  value: string
  onChange: (value: string) => void
  /** What is being searched, lower-cased into the placeholder: "Search work…". */
  label: string
  className?: string
}) {
  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Search ${label}…`}
        aria-label={`Search ${label}`}
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            onClick={() => onChange("")}
            aria-label="Clear search"
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}
