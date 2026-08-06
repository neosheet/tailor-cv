import * as React from "react"
import {
  AtSignIcon,
  AwardIcon,
  BadgeCheckIcon,
  BookIcon,
  BookOpenIcon,
  BookmarkIcon,
  BriefcaseIcon,
  Building2Icon,
  BuildingIcon,
  CalendarIcon,
  ClipboardListIcon,
  ClockIcon,
  FolderIcon,
  GaugeIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  LanguagesIcon,
  LinkIcon,
  MailboxIcon,
  MapIcon,
  MapPinIcon,
  MegaphoneIcon,
  PercentIcon,
  PhoneIcon,
  QuoteIcon,
  Share2Icon,
  TagIcon,
  TextIcon,
  UserIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import { SkillLinkInput } from "@/components/inventory/skill-link-input"
import { PartialDatePicker } from "@/components/inventory/partial-date-picker"
import { LineListEditor, type LineDraft } from "@/components/inventory/line-list-editor"
import { LINE_HEADING, LINE_ORDER } from "@/components/inventory/columns"
import {
  createItem,
  createLine,
  deleteLine,
  linesOf,
  replaceItemSkills,
  skillsOf,
  updateItem,
  updateLine,
  type ItemInput,
  type ItemKind,
  type LineKind,
  type DbInventoryItem,
} from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"

/**
 * Add/edit form for one entry in any pool.
 *
 * A single dialog handles every kind — the field set, labels, and dialog
 * title all key off `kind`/`mode` rather than branching into a dozen
 * near-duplicate components. Basics kinds' fields live directly on
 * `inventory_items` with no nested lines; the other 11 kinds add a mix of
 * dates, `details` keys, `inventory_lines` sections, and (for `work`/
 * `volunteer`/`project`) a skill-link picker, per
 * `docs/specs/02-inventory-data-model.md`'s field mapping.
 */

type FieldKey =
  | "title"
  | "subtitle"
  | "summary"
  | "url"
  | "phone"
  | "image"
  | "address"
  | "postalCode"
  | "countryCode"
  | "startDate"
  | "endDate"
  | "yearsExperience"
  | "studyType"
  | "score"
  | "entity"
  | "type"
  | "employmentType"
  | "workplaceType"
  | "location"

type FieldConfig = {
  key: FieldKey
  label: string
  /** Undefined/absent renders a plain single-line text input. */
  kind?: "multiline" | "date" | "number"
  icon: LucideIcon
}

/** Which fields each kind shows, in order, per the spec's field mapping. */
const KIND_FIELDS: Record<ItemKind, FieldConfig[]> = {
  name: [{ key: "title", label: "Full name", icon: UserIcon }],
  headline: [{ key: "title", label: "Headline", icon: MegaphoneIcon }],
  summary: [
    { key: "title", label: "Label", icon: BookmarkIcon },
    { key: "summary", label: "Summary", kind: "multiline", icon: TextIcon },
  ],
  contact: [
    { key: "title", label: "Label", icon: BookmarkIcon },
    { key: "subtitle", label: "Email", icon: AtSignIcon },
    { key: "url", label: "Website", icon: LinkIcon },
    { key: "phone", label: "Phone", icon: PhoneIcon },
    { key: "image", label: "Photo URL", icon: ImageIcon },
  ],
  location: [
    { key: "title", label: "City", icon: MapPinIcon },
    { key: "subtitle", label: "Region", icon: MapIcon },
    { key: "address", label: "Address", icon: HomeIcon },
    { key: "postalCode", label: "Postal code", icon: MailboxIcon },
    { key: "countryCode", label: "Country code", icon: GlobeIcon },
  ],
  social: [
    { key: "title", label: "Network", icon: Share2Icon },
    { key: "subtitle", label: "Username", icon: UserIcon },
    { key: "url", label: "Profile URL", icon: LinkIcon },
  ],

  work: [
    { key: "title", label: "Company", icon: Building2Icon },
    { key: "subtitle", label: "Position", icon: BriefcaseIcon },
    { key: "url", label: "Company website", icon: LinkIcon },
    { key: "summary", label: "Description", kind: "multiline", icon: TextIcon },
    { key: "employmentType", label: "Employment type", icon: ClipboardListIcon },
    { key: "workplaceType", label: "Workplace type", icon: HomeIcon },
    { key: "location", label: "Location", icon: MapPinIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  volunteer: [
    { key: "title", label: "Organisation", icon: BuildingIcon },
    { key: "subtitle", label: "Position", icon: BriefcaseIcon },
    { key: "summary", label: "Description", kind: "multiline", icon: TextIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  education: [
    { key: "title", label: "Institution", icon: GraduationCapIcon },
    { key: "subtitle", label: "Area", icon: BookOpenIcon },
    { key: "studyType", label: "Study type", icon: ClipboardListIcon },
    { key: "score", label: "Score", icon: PercentIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  skill: [
    { key: "title", label: "Skill name", icon: WrenchIcon },
    { key: "subtitle", label: "Level", icon: GaugeIcon },
    {
      key: "yearsExperience",
      label: "Years of experience",
      kind: "number",
      icon: ClockIcon,
    },
  ],
  language: [
    { key: "title", label: "Language", icon: LanguagesIcon },
    { key: "subtitle", label: "Fluency", icon: GaugeIcon },
  ],
  interest: [{ key: "title", label: "Interest", icon: HeartIcon }],
  project: [
    { key: "title", label: "Project name", icon: FolderIcon },
    { key: "summary", label: "Description", kind: "multiline", icon: TextIcon },
    { key: "entity", label: "Entity", icon: Building2Icon },
    { key: "type", label: "Type", icon: TagIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  award: [
    { key: "title", label: "Award title", icon: AwardIcon },
    { key: "subtitle", label: "Awarder", icon: BuildingIcon },
    { key: "summary", label: "Summary", kind: "multiline", icon: TextIcon },
    { key: "startDate", label: "Awarded", kind: "date", icon: CalendarIcon },
  ],
  certificate: [
    { key: "title", label: "Certificate name", icon: BadgeCheckIcon },
    { key: "subtitle", label: "Issuer", icon: BuildingIcon },
    { key: "startDate", label: "Issued", kind: "date", icon: CalendarIcon },
  ],
  publication: [
    { key: "title", label: "Publication title", icon: BookIcon },
    { key: "subtitle", label: "Publisher", icon: BuildingIcon },
    { key: "summary", label: "Summary", kind: "multiline", icon: TextIcon },
    { key: "startDate", label: "Released", kind: "date", icon: CalendarIcon },
  ],
  reference: [
    { key: "title", label: "Name", icon: UserIcon },
    { key: "subtitle", label: "Role", icon: BriefcaseIcon },
    { key: "summary", label: "Reference", kind: "multiline", icon: QuoteIcon },
  ],
}

/** Which `LineKind`s each kind shows, in the fixed order every dialog uses. */
const KIND_LINE_KINDS: Partial<Record<ItemKind, LineKind[]>> = {
  work: ["responsibilities", "highlights"],
  volunteer: ["responsibilities", "highlights"],
  education: ["courses"],
  skill: ["keywords"],
  interest: ["keywords"],
  project: ["highlights", "keywords", "roles"],
}

/** Only these three kinds get the "Skills used" picker, per spec 02. */
const SKILL_LINK_KINDS: readonly ItemKind[] = ["work", "volunteer", "project"]

/** Lowercased so it reads naturally in "Add {label}" / "Edit {label}". */
const KIND_LABELS: Record<ItemKind, string> = {
  name: "name",
  headline: "headline",
  summary: "summary",
  contact: "contact",
  location: "location",
  social: "social",

  work: "work entry",
  volunteer: "volunteer entry",
  education: "education entry",
  skill: "skill",
  language: "language",
  interest: "interest",
  project: "project",
  award: "award",
  certificate: "certificate",
  publication: "publication",
  reference: "reference",
}

type FormState = Record<FieldKey, string> & {
  tags: string[]
  note: string | null
  lines: Partial<Record<LineKind, LineDraft[]>>
  skillIds: string[]
}

const EMPTY_STATE: FormState = {
  title: "",
  subtitle: "",
  summary: "",
  url: "",
  phone: "",
  image: "",
  address: "",
  postalCode: "",
  countryCode: "",
  startDate: "",
  endDate: "",
  yearsExperience: "",
  studyType: "",
  score: "",
  entity: "",
  type: "",
  employmentType: "",
  workplaceType: "",
  location: "",
  tags: [],
  note: null,
  lines: {},
  skillIds: [],
}

/** The flat fields only — `lines`/`skillIds` need store access, seeded separately. */
function stateFromItem(
  item: DbInventoryItem
): Omit<FormState, "lines" | "skillIds"> {
  const details = item.details as Record<string, unknown>
  const asString = (value: unknown) => (typeof value === "string" ? value : "")

  return {
    title: item.title,
    subtitle: item.subtitle ?? "",
    summary: item.summary ?? "",
    url: item.url ?? "",
    phone: asString(details.phone),
    image: asString(details.image),
    address: asString(details.address),
    postalCode: asString(details.postalCode),
    countryCode: asString(details.countryCode),
    startDate: item.startDate ?? "",
    endDate: item.endDate ?? "",
    yearsExperience:
      item.yearsExperience === null ? "" : String(item.yearsExperience),
    studyType: asString(details.studyType),
    score: asString(details.score),
    entity: asString(details.entity),
    type: asString(details.type),
    employmentType: asString(details.employmentType),
    workplaceType: asString(details.workplaceType),
    location: asString(details.location),
    tags: item.tags,
    note: item.note,
  }
}

/** "" normalizes to `null` — the flat fields mirror nullable db columns. */
function normalize(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** Maps the flat form state back onto `ItemInput`, `details` included. */
function buildInput(fields: FieldConfig[], state: FormState): ItemInput {
  const has = (key: FieldKey) => fields.some((field) => field.key === key)

  const details: Record<string, unknown> = {}
  if (has("phone")) details.phone = normalize(state.phone)
  if (has("image")) details.image = normalize(state.image)
  if (has("address")) details.address = normalize(state.address)
  if (has("postalCode")) details.postalCode = normalize(state.postalCode)
  if (has("countryCode")) details.countryCode = normalize(state.countryCode)
  if (has("studyType")) details.studyType = normalize(state.studyType)
  if (has("score")) details.score = normalize(state.score)
  if (has("entity")) details.entity = normalize(state.entity)
  if (has("type")) details.type = normalize(state.type)
  if (has("employmentType")) details.employmentType = normalize(state.employmentType)
  if (has("workplaceType")) details.workplaceType = normalize(state.workplaceType)
  if (has("location")) details.location = normalize(state.location)

  // Fields this kind doesn't configure stay `undefined`, not `null` — an
  // omitted key leaves the existing DB column untouched (see `updateItem`'s
  // merge-patch pattern). A kind's field config can be a strict subset of
  // what the column has ever held (e.g. `reference.subtitle` predates this
  // form and isn't in every kind's config), and defaulting the unconfigured
  // case to `null` would silently wipe that data on the first edit.
  return {
    title: state.title.trim(),
    subtitle: has("subtitle") ? normalize(state.subtitle) : undefined,
    summary: has("summary") ? normalize(state.summary) : undefined,
    url: has("url") ? normalize(state.url) : undefined,
    details,
    tags: state.tags,
    note: state.note,
    startDate: has("startDate") ? normalize(state.startDate) : undefined,
    endDate: has("endDate") ? normalize(state.endDate) : undefined,
    yearsExperience: has("yearsExperience")
      ? normalize(state.yearsExperience) === null
        ? null
        : Number(state.yearsExperience)
      : undefined,
  }
}

export function ItemDialog({
  kind,
  mode,
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  kind: ItemKind
  mode: "add" | "edit"
  item?: DbInventoryItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  // Lifted above `ItemForm` because closing can be triggered from outside
  // it too — Escape, an overlay click, the dialog's own X button — and every
  // path needs the same unsaved-changes guard, not just the Cancel button.
  const [dirty, setDirty] = React.useState(false)
  const [confirmDiscard, setConfirmDiscard] = React.useState(false)

  function requestClose() {
    if (dirty) {
      setConfirmDiscard(true)
    } else {
      onOpenChange(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(next) : requestClose())}
      >
        <DialogContent className="sm:max-w-2xl">
          {/* Keyed so every fresh open starts from clean state — reopening
              "Add" for a second row, or switching which row "Edit" targets,
              must not carry over the previous form's values. */}
          <ItemForm
            key={`${mode}-${item?.id ?? "new"}-${open}`}
            kind={kind}
            mode={mode}
            item={item}
            onDirtyChange={setDirty}
            onRequestClose={requestClose}
            onSaved={onSaved}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You've made changes to this {KIND_LABELS[kind]} that haven't been
              saved. Closing now will discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setConfirmDiscard(false)
                onOpenChange(false)
              }}
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ItemForm({
  kind,
  mode,
  item,
  onDirtyChange,
  onRequestClose,
  onSaved,
}: {
  kind: ItemKind
  mode: "add" | "edit"
  item?: DbInventoryItem
  onDirtyChange: (dirty: boolean) => void
  onRequestClose: () => void
  onSaved: () => void
}) {
  const store = useInventoryStore()
  const [initialState] = React.useState<FormState>(() => {
    const flat: Omit<FormState, "lines" | "skillIds"> =
      mode === "edit" && item ? stateFromItem(item) : EMPTY_STATE

    const lines: Partial<Record<LineKind, LineDraft[]>> = {}
    if (mode === "edit" && item) {
      for (const listKind of KIND_LINE_KINDS[kind] ?? []) {
        lines[listKind] = linesOf(store, item.id, listKind).map((line) => ({
          id: line.id,
          content: line.content,
          tags: line.tags,
          note: line.note,
        }))
      }
    }

    const skillIds =
      mode === "edit" && item && SKILL_LINK_KINDS.includes(kind)
        ? skillsOf(store, item.id).map((skill) => skill.id)
        : []

    return { ...flat, lines, skillIds }
  })
  const [state, setState] = React.useState<FormState>(initialState)

  const fields = KIND_FIELDS[kind]
  // `LINE_ORDER` (from `item-detail-dialog.tsx`) is the one fixed rendering
  // order for line kinds — filtering it down to this kind's own list kinds
  // keeps every dialog in the same order the detail view already uses,
  // rather than re-deriving it from `KIND_LINE_KINDS`' own array order.
  const lineKinds = LINE_ORDER.filter((listKind) =>
    (KIND_LINE_KINDS[kind] ?? []).includes(listKind)
  )
  const showSkillLink = SKILL_LINK_KINDS.includes(kind)

  const titleInvalid = state.title.trim() === ""

  const hasStartDate = fields.some((field) => field.key === "startDate")
  const hasEndDate = fields.some((field) => field.key === "endDate")
  const dateRangeInvalid =
    hasStartDate &&
    hasEndDate &&
    state.startDate !== "" &&
    state.endDate !== "" &&
    state.endDate < state.startDate

  const hasEmptyLine = lineKinds.some((listKind) =>
    (state.lines[listKind] ?? []).some((row) => row.content.trim() === "")
  )

  const canSave = !titleInvalid && !dateRangeInvalid && !hasEmptyLine

  React.useEffect(() => {
    onDirtyChange(JSON.stringify(state) !== JSON.stringify(initialState))
    // `initialState` and `onDirtyChange` are stable for this dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  function setField(key: FieldKey, value: string) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  function renderLineEditor(listKind: LineKind) {
    return (
      <LineListEditor
        key={listKind}
        listKind={listKind}
        label={LINE_HEADING[listKind]}
        value={state.lines[listKind] ?? []}
        onValueChange={(lines) =>
          setState((prev) => ({
            ...prev,
            lines: { ...prev.lines, [listKind]: lines },
          }))
        }
        multiline={listKind === "responsibilities"}
        showLabel={!useTabbedLines}
      />
    )
  }

  function renderField(field: FieldConfig) {
    const fieldId = `item-${field.key}`
    const titleFieldInvalid = field.key === "title" && titleInvalid
    const endDateFieldInvalid = field.key === "endDate" && dateRangeInvalid
    const invalid = titleFieldInvalid || endDateFieldInvalid

    if (field.kind === "date") {
      return (
        <Field key={field.key} data-invalid={invalid ? true : undefined}>
          <FieldLabel htmlFor={fieldId}>{field.label}</FieldLabel>
          <PartialDatePicker
            id={fieldId}
            value={state[field.key] || null}
            onValueChange={(iso) => setField(field.key, iso ?? "")}
          />
          {endDateFieldInvalid ? (
            <FieldError>End date can't be before start date.</FieldError>
          ) : null}
        </Field>
      )
    }

    return (
      <Field key={field.key} data-invalid={invalid ? true : undefined}>
        <FieldLabel htmlFor={fieldId} className="sr-only">
          {field.label}
        </FieldLabel>
        <InputGroup>
          {field.kind === "multiline" ? (
            <>
              <InputGroupAddon align="block-start">
                <field.icon />
                <InputGroupText>{field.label}</InputGroupText>
              </InputGroupAddon>
              <InputGroupTextarea
                id={fieldId}
                value={state[field.key]}
                onChange={(event) => setField(field.key, event.target.value)}
              />
            </>
          ) : (
            <>
              <InputGroupAddon>
                <field.icon />
              </InputGroupAddon>
              <InputGroupInput
                id={fieldId}
                type={field.kind === "number" ? "number" : "text"}
                placeholder={field.label}
                value={state[field.key]}
                aria-invalid={invalid ? true : undefined}
                onChange={(event) => setField(field.key, event.target.value)}
              />
            </>
          )}
        </InputGroup>
      </Field>
    )
  }

  async function handleSave() {
    if (!canSave) {
      return
    }

    const input = buildInput(fields, state)
    const savedItem =
      mode === "edit" && item
        ? await updateItem(store, item.id, input)
        : await createItem(store, kind, input)

    for (const listKind of lineKinds) {
      const original = initialState.lines[listKind] ?? []
      const current = state.lines[listKind] ?? []
      const originalById = new Map(
        original.filter((line) => line.id).map((line) => [line.id, line])
      )
      const currentIds = new Set(
        current.filter((line) => line.id).map((line) => line.id)
      )

      for (const line of original) {
        if (line.id && !currentIds.has(line.id)) {
          await deleteLine(store, line.id)
        }
      }

      for (const line of current) {
        if (!line.id) {
          await createLine(store, savedItem.id, listKind, {
            content: line.content,
            tags: line.tags,
            note: line.note,
          })
          continue
        }

        const before = originalById.get(line.id)
        if (
          before &&
          (before.content !== line.content ||
            before.note !== line.note ||
            JSON.stringify(before.tags) !== JSON.stringify(line.tags))
        ) {
          await updateLine(store, line.id, {
            content: line.content,
            tags: line.tags,
            note: line.note,
          })
        }
      }
    }

    if (showSkillLink) {
      await replaceItemSkills(store, savedItem.id, state.skillIds)
    }

    onSaved()
  }

  // Work entries carry two long, bullet-heavy lists — splitting them into
  // their own tabs keeps the main details from being buried under a wall of
  // responsibilities and highlights. Other kinds' line lists are short enough
  // to sit inline.
  const useTabbedLines = kind === "work" && lineKinds.length > 0

  const detailsPanel = (
    <>
      <FieldGroup>
        {fields.map((field, index) => {
          // Start/end dates render together in one row rather than as two
          // stacked fields — `renderField` on both, `endDate` skipped on
          // its own turn since the `startDate` pass already emitted it.
          if (
            field.key === "endDate" &&
            fields[index - 1]?.key === "startDate"
          ) {
            return null
          }

          if (
            field.key === "startDate" &&
            fields[index + 1]?.key === "endDate"
          ) {
            return (
              <div key="date-range" className="grid grid-cols-2 gap-4">
                {renderField(field)}
                {renderField(fields[index + 1])}
              </div>
            )
          }

          return renderField(field)
        })}
      </FieldGroup>

      {useTabbedLines ? null : lineKinds.map(renderLineEditor)}

      {showSkillLink ? (
        <Field>
          <FieldLabel htmlFor="item-skills">Skills used</FieldLabel>
          <SkillLinkInput
            id="item-skills"
            value={state.skillIds}
            onValueChange={(skillIds) =>
              setState((prev) => ({ ...prev, skillIds }))
            }
            excludeItemId={item?.id}
          />
        </Field>
      ) : null}

      {/* Secondary area: fields every kind shares (unlike the ones above,
        which vary per kind) get their own muted panel so they read as
        metadata about the row rather than part of the main form. */}
      <FieldGroup className="-mx-4 mt-4 w-auto border-t bg-muted/50 px-4 py-4">
        <NoteInput
          value={state.note}
          onValueChange={(note) => setState((prev) => ({ ...prev, note }))}
        />

        <TagInput
          id="item-tags"
          value={state.tags}
          onValueChange={(tags) => setState((prev) => ({ ...prev, tags }))}
        />
      </FieldGroup>
    </>
  )

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "add" ? "Add" : "Edit"} {KIND_LABELS[kind]}
        </DialogTitle>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4 pt-2 -mb-4">
        {useTabbedLines ? (
          <Tabs defaultValue="details" className="gap-4">
            <TabsList variant="line">
              <TabsTrigger value="details">Details</TabsTrigger>
              {lineKinds.map((listKind) => (
                <TabsTrigger key={listKind} value={listKind}>
                  {LINE_HEADING[listKind]}
                  <span className="text-muted-foreground tabular-nums">
                    {(state.lines[listKind] ?? []).length}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="details" className="flex flex-col gap-4">
              {detailsPanel}
            </TabsContent>

            {lineKinds.map((listKind) => (
              <TabsContent key={listKind} value={listKind} className="pb-4">
                {renderLineEditor(listKind)}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          detailsPanel
        )}
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onRequestClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={!canSave}>
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
