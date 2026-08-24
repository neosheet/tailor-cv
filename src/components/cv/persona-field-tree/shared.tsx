/* eslint-disable react-refresh/only-export-components */
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { inventoryPages } from "@/lib/navigation"
import { normalizeOptions, stylePropertyDef, type StylePropertyDef } from "@/lib/style-property-schema"
import { cn } from "@/lib/utils"
import type { ItemKind } from "@/mocks/types"

/** The Basics kinds, header order — never reorderable (fixed template layout). */
export const BASICS_KINDS: ItemKind[] = [
  "name",
  "headline",
  "summary",
  "contact",
  "location",
  "social",
]

/** Icon per kind, reusing the same icons the Inventory nav already uses. */
export const KIND_ICON: Record<ItemKind, LucideIcon> = {
  name: inventoryPages.basics.icon,
  headline: inventoryPages.basics.icon,
  summary: inventoryPages.basics.icon,
  contact: inventoryPages.basics.icon,
  location: inventoryPages.basics.icon,
  social: inventoryPages.basics.icon,
  work: inventoryPages.work.icon,
  education: inventoryPages.education.icon,
  skill: inventoryPages.skills.icon,
  language: inventoryPages.languages.icon,
  project: inventoryPages.projects.icon,
  volunteer: inventoryPages.volunteer.icon,
  award: inventoryPages.awards.icon,
  certificate: inventoryPages.certificates.icon,
  publication: inventoryPages.publications.icon,
  interest: inventoryPages.interests.icon,
  reference: inventoryPages.references.icon,
}

export type Reorder = {
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

export function EyeToggle({
  label,
  hidden,
  onToggle,
}: {
  label: string
  hidden: boolean
  onToggle: () => void
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={onToggle}
      aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
      aria-pressed={hidden}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </Button>
  )
}

export function ReorderButtons({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: Reorder & { label: string }) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!canMoveUp}
        onClick={onMoveUp}
        aria-label={`Move ${label} up`}
      >
        <ArrowUpIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!canMoveDown}
        onClick={onMoveDown}
        aria-label={`Move ${label} down`}
      >
        <ArrowDownIcon />
      </Button>
    </>
  )
}

/** A togglable leaf row — a field name or a bullet's content — at some indent. */
export function LeafRow({
  label,
  hidden,
  onToggle,
  indent = "pl-10",
}: {
  label: string
  hidden: boolean
  onToggle: () => void
  indent?: "pl-10" | "pl-14"
}) {
  return (
    <div className={cn("flex items-center gap-1 py-1 pr-1 text-sm", indent)}>
      <span
        className={cn(
          "flex-1 truncate",
          hidden && "text-muted-foreground line-through"
        )}
      >
        {label}
      </span>
      <EyeToggle label={label} hidden={hidden} onToggle={onToggle} />
    </div>
  )
}

/** A parent row — folder icon + chevron + eye toggle, expanding into children. */
export function ParentRow({
  icon: Icon,
  label,
  hidden,
  open,
  expandable,
  onToggleHidden,
  reorder,
}: {
  icon: LucideIcon
  label: string
  hidden: boolean
  open: boolean
  expandable: boolean
  onToggleHidden: () => void
  reorder?: Reorder
}) {
  return (
    <div className="flex items-center gap-1 rounded-md py-1 pr-1 pl-1 text-sm hover:bg-muted">
      {expandable ? (
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={open ? `Collapse ${label}` : `Expand ${label}`}
            />
          }
        >
          <ChevronRightIcon
            className={cn("size-3.5 transition-transform", open && "rotate-90")}
          />
        </CollapsibleTrigger>
      ) : (
        <span className="size-6 shrink-0" />
      )}
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span
        className={cn(
          "flex-1 truncate font-medium",
          hidden && "text-muted-foreground line-through"
        )}
      >
        {label}
      </span>
      {reorder ? <ReorderButtons label={label} {...reorder} /> : null}
      <EyeToggle label={label} hidden={hidden} onToggle={onToggleHidden} />
    </div>
  )
}

/** The control matching a property's input kind — number, select, color, or plain text. */
function StyleValueControl({
  def,
  value,
  onChange,
}: {
  def: ReturnType<typeof stylePropertyDef>
  value: string | number | undefined
  onChange: (value: string | number) => void
}) {
  if (def.input === "color") {
    const hex = typeof value === "string" && /^#/.test(value) ? value : "#000000"
    return (
      <div className="flex flex-1 items-center gap-1.5">
        <input
          type="color"
          className="h-7 w-8 shrink-0 rounded-md border border-input bg-transparent p-0.5"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          className="h-7 flex-1 text-xs"
          value={value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  }

  if (def.input === "select") {
    const options = normalizeOptions(def.options, value)
    return (
      <Select
        items={options}
        value={value === undefined ? "" : String(value)}
        onValueChange={(next) => {
          const match = options.find((option) => String(option.value) === next)
          onChange(match ? match.value : (next as string))
        }}
      >
        <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={String(option.value)} value={String(option.value)}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    )
  }

  if (def.input === "number") {
    return (
      <Input
        type="number"
        step={def.step ?? 1}
        className="h-7 flex-1 text-xs"
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    )
  }

  return (
    <Input
      className="h-7 flex-1 text-xs"
      value={value === undefined ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

/**
 * One property row: label, its control, and a reset-to-template button.
 * Shared by the Style tab (a named style's properties), the Page tab
 * (`TemplateDefinition.page`'s properties), and the Block tab (a node
 * override's properties) — same control set, different mutator wired in by
 * the caller.
 */
export function PropertyRow({
  propKey,
  def,
  value,
  overridden,
  onChange,
  onReset,
}: {
  propKey: string
  def: StylePropertyDef
  value: string | number | undefined
  overridden: boolean
  onChange: (value: string | number) => void
  onReset: () => void
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span
        className="w-28 shrink-0 truncate text-xs text-muted-foreground"
        title={propKey}
      >
        {def.title}
      </span>
      <StyleValueControl def={def} value={value} onChange={onChange} />
      <Button
        variant="ghost"
        size="icon-xs"
        disabled={!overridden}
        onClick={onReset}
        aria-label={`Reset ${def.title} to the template's value`}
      >
        <RotateCcwIcon />
      </Button>
    </div>
  )
}
