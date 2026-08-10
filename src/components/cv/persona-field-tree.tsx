import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  RotateCcwIcon,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LINE_HEADING } from "@/components/inventory/columns"
import {
  resetCvNodeOverride,
  resetCvPageProperty,
  resetCvStyleProperty,
  setCvNodeOverride,
  setCvPageProperty,
  setCvStyleProperty,
  setFieldHidden,
  setItemHidden,
  setKindHidden,
} from "@/lib/cv"
import type { CvTemplate } from "@/lib/cv-templates"
import { collectBlockNodeIds, resolveStyleObject } from "@/lib/cv-template-core"
import { linesOf } from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"
import { inventoryPages } from "@/lib/navigation"
import {
  FIELD_REGISTRY,
  hiddenFieldsOf,
  isItemHidden,
  isKindHidden,
  LINE_ORDER,
  orderedSectionKinds,
  reorderPersonaSections,
  selectedEntriesOf,
  selectedLineIdsOf,
  setLineSelected,
  titleFor,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import {
  defaultStyleValue,
  humanize,
  normalizeOptions,
  STYLE_GROUP_ORDER,
  STYLE_PROPERTY_SCHEMA,
  stylePropertyDef,
  type StyleGroup,
  type StylePropertyDef,
} from "@/lib/style-property-schema"
import { EDITABLE_PAGE_KEYS, PAGE_PROPERTY_SCHEMA } from "@/lib/page-property-schema"
import { cn } from "@/lib/utils"
import type { DbCv, DbInventoryItem, ItemKind } from "@/mocks/types"

/** The Basics kinds, header order — never reorderable (fixed template layout). */
const BASICS_KINDS: ItemKind[] = [
  "name",
  "headline",
  "summary",
  "contact",
  "location",
  "social",
]

/** Icon per kind, reusing the same icons the Inventory nav already uses. */
const KIND_ICON: Record<ItemKind, LucideIcon> = {
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

type Reorder = {
  canMoveUp: boolean
  canMoveDown: boolean
  onMoveUp: () => void
  onMoveDown: () => void
}

function EyeToggle({
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

function ReorderButtons({
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
function LeafRow({
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
function ParentRow({
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

// ---------------------------------------------------------------------------
// Visibility tab — kind/field structural visibility + Section order
// ---------------------------------------------------------------------------

/** One kind — Basics field or Section — as a tree row. Expands into field rows when the kind has more than one togglable field. */
function KindRow({
  cv,
  kind,
  hidden,
  hiddenFields,
  reorder,
}: {
  cv: DbCv
  kind: ItemKind
  hidden: boolean
  hiddenFields: Set<string>
  reorder?: Reorder
}) {
  const personaStore = usePersonaStore()
  const [open, setOpen] = React.useState(false)

  const label = titleFor(kind)
  const fields = FIELD_REGISTRY[kind]

  const row = (
    <ParentRow
      icon={KIND_ICON[kind]}
      label={label}
      hidden={hidden}
      open={open}
      expandable={Boolean(fields)}
      onToggleHidden={() =>
        void setKindHidden(personaStore, cv.id, kind, !hidden)
      }
      reorder={reorder}
    />
  )

  if (!fields) {
    return row
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {row}
      <CollapsibleContent>
        {fields.map((field) => (
          <LeafRow
            key={field.key}
            label={field.label}
            hidden={hiddenFields.has(field.key)}
            onToggle={() =>
              void setFieldHidden(
                personaStore,
                cv.id,
                kind,
                field.key,
                !hiddenFields.has(field.key)
              )
            }
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function VisibilityTab({ cv }: { cv: DbCv }) {
  const personaStore = usePersonaStore()
  if (!cv.personaId) {
    return null
  }
  const personaId = cv.personaId
  const persona = personaStore.personas.find((row) => row.id === personaId)
  if (!persona) {
    return null
  }

  const fieldVisibility = cv.personaSettings.fieldVisibility ?? {}
  const sectionOrder = orderedSectionKinds(personaStore, personaId)

  return (
    <>
      <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Basics
      </p>
      <div className="flex flex-col">
        {BASICS_KINDS.map((kind) => (
          <KindRow
            key={kind}
            cv={cv}
            kind={kind}
            hidden={isKindHidden(fieldVisibility, kind)}
            hiddenFields={hiddenFieldsOf(fieldVisibility, kind)}
          />
        ))}
      </div>

      <Separator className="my-2" />

      <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Sections
      </p>
      <div className="flex flex-col">
        {sectionOrder.map((kind, index) => (
          <KindRow
            key={kind}
            cv={cv}
            kind={kind}
            hidden={isKindHidden(fieldVisibility, kind)}
            hiddenFields={hiddenFieldsOf(fieldVisibility, kind)}
            reorder={{
              canMoveUp: index > 0,
              canMoveDown: index < sectionOrder.length - 1,
              onMoveUp: () => {
                const next = [...sectionOrder]
                ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                void reorderPersonaSections(personaStore, personaId, next)
              },
              onMoveDown: () => {
                const next = [...sectionOrder]
                ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                void reorderPersonaSections(personaStore, personaId, next)
              },
            }}
          />
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Data tab — which selected entries, and which of their bullets, print
// ---------------------------------------------------------------------------

/** One selected entry (a job, a skill, a social link, ...) with its bullets, if any. */
function ItemRow({
  cv,
  personaId,
  kind,
  item,
}: {
  cv: DbCv
  personaId: string
  kind: ItemKind
  item: DbInventoryItem
}) {
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const [open, setOpen] = React.useState(false)

  const fieldVisibility = cv.personaSettings.fieldVisibility ?? {}
  const hidden = isItemHidden(fieldVisibility, kind, item.id)
  const chosenLineIds = selectedLineIdsOf(personaStore, personaId, item.id)

  const lineGroups = LINE_ORDER.flatMap((lineKind) => {
    const lines = linesOf(inventoryStore, item.id, lineKind)
    return lines.length > 0 ? [{ lineKind, lines }] : []
  })

  const label = item.subtitle ? `${item.title} — ${item.subtitle}` : item.title

  const row = (
    <ParentRow
      icon={KIND_ICON[kind]}
      label={label}
      hidden={hidden}
      open={open}
      expandable={lineGroups.length > 0}
      onToggleHidden={() =>
        void setItemHidden(personaStore, cv.id, kind, item.id, !hidden)
      }
    />
  )

  if (lineGroups.length === 0) {
    return row
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {row}
      <CollapsibleContent>
        {lineGroups.map(({ lineKind, lines }) => (
          <div key={lineKind}>
            <p className="pt-1 pr-1 pb-1 pl-14 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {LINE_HEADING[lineKind]}
            </p>
            {lines.map((line) => (
              <LeafRow
                key={line.id}
                label={line.content}
                hidden={!chosenLineIds.has(line.id)}
                onToggle={() =>
                  void setLineSelected(
                    personaStore,
                    personaId,
                    item.id,
                    line.id,
                    !chosenLineIds.has(line.id)
                  )
                }
                indent="pl-14"
              />
            ))}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function DataTab({ cv }: { cv: DbCv }) {
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  if (!cv.personaId) {
    return null
  }
  const personaId = cv.personaId
  const dataKinds: ItemKind[] = [
    "social",
    ...orderedSectionKinds(personaStore, personaId),
  ]

  const groups = dataKinds.flatMap((kind) => {
    const items = selectedEntriesOf(personaStore, inventoryStore, personaId, kind)
    return items.length > 0 ? [{ kind, items }] : []
  })

  if (groups.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        No entries selected yet — pick some from the Persona page first.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ kind, items }) => (
        <div key={kind}>
          <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {titleFor(kind)}
          </p>
          <div className="flex flex-col">
            {items.map((item) => (
              <ItemRow key={item.id} cv={cv} personaId={personaId} kind={kind} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Style tab — per-CV overrides on the template's named styles
// ---------------------------------------------------------------------------

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
 * Shared by the Style tab (a named style's properties) and the Page tab
 * (`TemplateDefinition.page`'s properties) — same control set, different
 * mutator wired in by the caller.
 */
function PropertyRow({
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

/** The "+ Add property" row — only offers keys not already on the style. */
function AddStyleProperty({
  present,
  onAdd,
}: {
  present: Set<string>
  onAdd: (key: string) => void
}) {
  const [key, setKey] = React.useState("")
  const options = Object.keys(STYLE_PROPERTY_SCHEMA)
    .filter((k) => !present.has(k))
    .map((k) => ({ value: k, label: STYLE_PROPERTY_SCHEMA[k].title }))

  if (options.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 px-2 pt-2">
      <Select items={options} value={key} onValueChange={(next) => setKey(next as string)}>
        <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
          <SelectValue placeholder="+ Add property…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={!key}
        onClick={() => {
          onAdd(key)
          setKey("")
        }}
      >
        Add
      </Button>
    </div>
  )
}

function StyleTab({ cv, template }: { cv: DbCv; template: CvTemplate }) {
  const personaStore = usePersonaStore()
  const styleNames = Object.keys(template.definition.styles)
  const [selected, setSelected] = React.useState(styleNames[0] ?? "")

  if (styleNames.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        This template defines no editable styles.
      </p>
    )
  }

  const cur = styleNames.includes(selected) ? selected : styleNames[0]
  const baseStyle = resolveStyleObject(cur, template.definition.styles, undefined, undefined)
  const override = cv.templateSettings.styles?.[cur] ?? {}
  const effective: Record<string, string | number> = { ...baseStyle, ...override }
  const keys = Object.keys(effective)

  const grouped: Partial<Record<StyleGroup, string[]>> = {}
  for (const propKey of keys) {
    const group = stylePropertyDef(propKey, effective[propKey]).group
    ;(grouped[group] ??= []).push(propKey)
  }

  const styleMeta = template.definition.stylesSchema
  const styleOptions = styleNames.map((name) => ({
    value: name,
    label: styleMeta?.[name]?.title ?? humanize(name),
  }))
  const curDescription = styleMeta?.[cur]?.description

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-2">
        <span className="text-xs font-medium text-muted-foreground">Style</span>
        <Select items={styleOptions} value={cur} onValueChange={(next) => setSelected(next as string)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {styleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {curDescription ? (
          <p className="text-xs text-muted-foreground">{curDescription}</p>
        ) : null}
      </div>

      {keys.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">No properties on this style.</p>
      ) : null}

      {STYLE_GROUP_ORDER.filter((group) => grouped[group]).map((group) => (
        <div key={group}>
          <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group}
          </p>
          <div className="flex flex-col px-2">
            {grouped[group]!.map((propKey) => (
              <PropertyRow
                key={propKey}
                propKey={propKey}
                def={stylePropertyDef(propKey, effective[propKey])}
                value={effective[propKey]}
                overridden={propKey in override}
                onChange={(next) =>
                  void setCvStyleProperty(personaStore, cv.id, cur, propKey, next)
                }
                onReset={() => void resetCvStyleProperty(personaStore, cv.id, cur, propKey)}
              />
            ))}
          </div>
        </div>
      ))}

      <AddStyleProperty
        present={new Set(keys)}
        onAdd={(propKey) =>
          void setCvStyleProperty(
            personaStore,
            cv.id,
            cur,
            propKey,
            defaultStyleValue(propKey)
          )
        }
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page tab — per-CV overrides on the template's page config
// ---------------------------------------------------------------------------

function PageTab({ cv, template }: { cv: DbCv; template: CvTemplate }) {
  const personaStore = usePersonaStore()
  const page = template.definition.page
  const override = cv.templateSettings.page ?? {}

  // Only the scalar fields `page-property-schema.ts` knows how to edit —
  // `page`/`override` also carry `header`/`footer` (structured TemplateNode
  // content), which don't fit a `string | number` control.
  const effective: Record<string, string | number> = {}
  for (const key of EDITABLE_PAGE_KEYS) {
    const value = override[key] ?? page[key]
    if (value !== undefined) {
      effective[key] = value as string | number
    }
  }

  const grouped: Partial<Record<StyleGroup, (keyof typeof PAGE_PROPERTY_SCHEMA)[]>> = {}
  for (const key of EDITABLE_PAGE_KEYS) {
    const group = PAGE_PROPERTY_SCHEMA[key]!.group
    ;(grouped[group] ??= []).push(key)
  }

  return (
    <div className="flex flex-col gap-3">
      {STYLE_GROUP_ORDER.filter((group) => grouped[group]).map((group) => (
        <div key={group}>
          <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group}
          </p>
          <div className="flex flex-col px-2">
            {grouped[group]!.map((key) => (
              <PropertyRow
                key={key}
                propKey={key}
                def={PAGE_PROPERTY_SCHEMA[key]!}
                value={effective[key]}
                overridden={key in override}
                onChange={(next) => void setCvPageProperty(personaStore, cv.id, key, next)}
                onReset={() => void resetCvPageProperty(personaStore, cv.id, key)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Block Settings tab — per-CV overrides on one specific node instance
// ---------------------------------------------------------------------------

function BlockTab({ cv, template }: { cv: DbCv; template: CvTemplate }) {
  const personaStore = usePersonaStore()
  const blockMeta = template.definition.blocksSchema

  const nodeIds = React.useMemo(
    () => collectBlockNodeIds(template.definition),
    [template.definition]
  )

  const groups = React.useMemo(() => {
    const byBlock = new Map<string, typeof nodeIds>()
    for (const entry of nodeIds) {
      const list = byBlock.get(entry.blockName)
      if (list) {
        list.push(entry)
      } else {
        byBlock.set(entry.blockName, [entry])
      }
    }
    return [...byBlock.entries()]
  }, [nodeIds])

  const [selected, setSelected] = React.useState(nodeIds[0]?.id ?? "")

  if (nodeIds.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        This template defines no customizable nodes.
      </p>
    )
  }

  const current = nodeIds.find((entry) => entry.id === selected) ?? nodeIds[0]
  const nodeOptions = nodeIds.map((entry) => ({
    value: entry.id,
    label: humanize(entry.id),
  }))

  const styleMeta = template.definition.stylesSchema
  const styleOptions = [
    { value: "", label: "Template default" },
    ...Object.keys(template.definition.styles).map((name) => ({
      value: name,
      label: styleMeta?.[name]?.title ?? humanize(name),
    })),
  ]

  const override = cv.templateSettings.nodes?.[current.id] ?? {}
  const overriddenStyle = Array.isArray(override.styles)
    ? (override.styles[0] ?? "")
    : (override.styles ?? "")
  const overriddenText = override.text

  return (
    <div className="flex flex-col gap-3">
      <p className="px-2 text-sm text-muted-foreground">
        Override one specific spot in the template — grouped by which block it
        belongs to. Changes apply only to this CV.
      </p>

      <div className="flex flex-col gap-1 px-2">
        <span className="text-xs font-medium text-muted-foreground">Node</span>
        <Select
          items={nodeOptions}
          value={current.id}
          onValueChange={(next) => setSelected(next as string)}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {groups.map(([blockName, entries]) => (
                <React.Fragment key={blockName}>
                  <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {blockMeta?.[blockName]?.title ?? humanize(blockName)}
                  </p>
                  {entries.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {humanize(entry.id)}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {blockMeta?.[current.blockName]?.description ? (
          <p className="text-xs text-muted-foreground">
            {blockMeta[current.blockName].description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col px-2">
        <PropertyRow
          propKey="styles"
          def={{ title: "Style", input: "select", group: "Other", options: styleOptions }}
          value={overriddenStyle}
          overridden={override.styles !== undefined}
          onChange={(next) =>
            next === ""
              ? void resetCvNodeOverride(personaStore, cv.id, current.id, "styles")
              : void setCvNodeOverride(personaStore, cv.id, current.id, {
                  styles: String(next),
                })
          }
          onReset={() => void resetCvNodeOverride(personaStore, cv.id, current.id, "styles")}
        />

        {current.hasText ? (
          <PropertyRow
            propKey="text"
            def={{ title: "Text", input: "text", group: "Other" }}
            value={overriddenText}
            overridden={overriddenText !== undefined}
            onChange={(next) =>
              void setCvNodeOverride(personaStore, cv.id, current.id, { text: String(next) })
            }
            onReset={() => void resetCvNodeOverride(personaStore, cv.id, current.id, "text")}
          />
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

export type PersonaFieldTreeProps = {
  cv: DbCv
  template: CvTemplate
}

/**
 * Persona print settings, in five tabs:
 * - **Visibility** — show/hide any Basics field or Section, hide individual
 *   fields within a Section's entries (e.g. Work's company name), and
 *   reorder Sections. Per-CV (Batch 3, docs/user-request.md) — two CVs off
 *   the same Persona can show different things.
 * - **Data** — show/hide one already-selected entry (a Skill, a Social
 *   link, a Work entry) without deselecting it, and pick which of its
 *   bullets (responsibilities, highlights, courses, keywords, roles) print.
 * - **Style** — edit the current Template's own named styles (font size,
 *   padding, colors, ...) for this CV only. Field list is manifest-driven —
 *   see `lib/style-property-schema.ts` — and reflects whatever properties
 *   the selected style actually has, same idea as json-ui's StyleEditor.
 * - **Page** — edit the Template's page config (paper size, orientation,
 *   margin, base typography) for this CV only — same manifest-driven
 *   approach as Style, over the fixed field set in
 *   `lib/page-property-schema.ts`.
 * - **Block Settings** — override one specific node instance in the template
 *   tree (a bullet marker's glyph, a separator, which style a section
 *   heading uses, ...) for this CV only — see `lib/cv-template-core.ts`'s
 *   `collectBlockNodeIds`.
 *
 * Every toggle writes straight through — see `lib/cv.ts`'s
 * `setKindHidden`/`setFieldHidden`/`setItemHidden`/`setCvStyleProperty`/
 * `resetCvStyleProperty`/`setCvPageProperty`/`resetCvPageProperty`/
 * `setCvNodeOverride`/`resetCvNodeOverride`, and `lib/persona.ts`'s
 * `setLineSelected`/`reorderPersonaSections` (genuine Persona content,
 * unaffected by the visibility move).
 */
export function PersonaFieldTree({ cv, template }: PersonaFieldTreeProps) {
  const isFrozen = cv.personaId === null

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
        <Tabs
          defaultValue={isFrozen ? "style" : "visibility"}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList variant="line" className="mx-2 mt-2 w-fit self-start">
            {isFrozen ? null : (
              <>
                <TabsTrigger value="visibility">Visibility</TabsTrigger>
                <TabsTrigger value="data">Data</TabsTrigger>
              </>
            )}
            <TabsTrigger value="style">Style</TabsTrigger>
            <TabsTrigger value="page">Page</TabsTrigger>
            <TabsTrigger value="blocks">Block</TabsTrigger>
          </TabsList>
          {isFrozen ? null : (
            <>
              <TabsContent
                value="visibility"
                className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
              >
                <VisibilityTab cv={cv} />
              </TabsContent>
              <TabsContent value="data" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                <DataTab cv={cv} />
              </TabsContent>
            </>
          )}
          <TabsContent value="style" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <StyleTab cv={cv} template={template} />
          </TabsContent>
          <TabsContent value="page" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <PageTab cv={cv} template={template} />
          </TabsContent>
          <TabsContent value="blocks" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <BlockTab cv={cv} template={template} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
