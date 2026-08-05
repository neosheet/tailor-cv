import * as React from "react"
import {
  AtSignIcon,
  BookmarkIcon,
  GlobeIcon,
  HomeIcon,
  ImageIcon,
  LinkIcon,
  MailboxIcon,
  MapIcon,
  MapPinIcon,
  MegaphoneIcon,
  PhoneIcon,
  Share2Icon,
  TextIcon,
  UserIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import {
  createItem,
  updateItem,
  type BasicsItemInput,
  type BasicsKind,
  type DbInventoryItem,
} from "@/mocks"

/**
 * Add/edit form for one of the six Basics pools.
 *
 * A single dialog handles both modes — the field set, labels, and dialog title
 * all key off `kind`/`mode` rather than branching into six near-duplicate
 * components. Every kind's fields live directly on `inventory_items`
 * (`docs/specs/02-inventory-data-model.md:272-301`), so unlike the other 12
 * pools there are no nested lines to author here.
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

type FieldConfig = {
  key: FieldKey
  label: string
  multiline?: boolean
  icon: LucideIcon
}

/** Which fields each kind shows, in order, per the spec's field mapping. */
const KIND_FIELDS: Record<BasicsKind, FieldConfig[]> = {
  name: [{ key: "title", label: "Full name", icon: UserIcon }],
  headline: [{ key: "title", label: "Headline", icon: MegaphoneIcon }],
  summary: [
    { key: "title", label: "Label", icon: BookmarkIcon },
    { key: "summary", label: "Summary", multiline: true, icon: TextIcon },
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
}

/** Lowercased so it reads naturally in "Add {label}" / "Edit {label}". */
const KIND_LABELS: Record<BasicsKind, string> = {
  name: "name",
  headline: "headline",
  summary: "summary",
  contact: "contact",
  location: "location",
  social: "social",
}

type FormState = Record<FieldKey, string> & {
  tags: string[]
  note: string | null
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
  tags: [],
  note: null,
}

function stateFromItem(item: DbInventoryItem): FormState {
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
    tags: item.tags,
    note: item.note,
  }
}

/** "" normalizes to `null` — the flat fields mirror nullable db columns. */
function normalize(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === "" ? null : trimmed
}

/** Maps the flat form state back onto `BasicsItemInput`, `details` included. */
function buildInput(fields: FieldConfig[], state: FormState): BasicsItemInput {
  const has = (key: FieldKey) => fields.some((field) => field.key === key)

  const details: Record<string, unknown> = {}
  if (has("phone")) details.phone = normalize(state.phone)
  if (has("image")) details.image = normalize(state.image)
  if (has("address")) details.address = normalize(state.address)
  if (has("postalCode")) details.postalCode = normalize(state.postalCode)
  if (has("countryCode")) details.countryCode = normalize(state.countryCode)

  return {
    title: state.title.trim(),
    subtitle: has("subtitle") ? normalize(state.subtitle) : null,
    summary: has("summary") ? normalize(state.summary) : null,
    url: has("url") ? normalize(state.url) : null,
    details,
    tags: state.tags,
    note: state.note,
  }
}

export function BasicsItemDialog({
  kind,
  mode,
  item,
  open,
  onOpenChange,
  onSaved,
}: {
  kind: BasicsKind
  mode: "add" | "edit"
  item?: DbInventoryItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {/* Keyed so every fresh open starts from clean state — reopening
            "Add" for a second row, or switching which row "Edit" targets,
            must not carry over the previous form's values. */}
        <DialogBody
          key={`${mode}-${item?.id ?? "new"}-${open}`}
          kind={kind}
          mode={mode}
          item={item}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  )
}

function DialogBody({
  kind,
  mode,
  item,
  onOpenChange,
  onSaved,
}: {
  kind: BasicsKind
  mode: "add" | "edit"
  item?: DbInventoryItem
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const [state, setState] = React.useState<FormState>(() =>
    mode === "edit" && item ? stateFromItem(item) : EMPTY_STATE
  )

  const fields = KIND_FIELDS[kind]
  const titleInvalid = state.title.trim() === ""

  function setField(key: FieldKey, value: string) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    if (titleInvalid) {
      return
    }

    const input = buildInput(fields, state)

    if (mode === "edit" && item) {
      updateItem(item.id, input)
    } else {
      createItem(kind, input)
    }

    onSaved()
    onOpenChange(false)
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "add" ? "Add" : "Edit"} {KIND_LABELS[kind]}
        </DialogTitle>
      </DialogHeader>

      <FieldGroup className="pb-4">
        {fields.map((field) => {
          const fieldId = `basics-item-${field.key}`
          const invalid = field.key === "title" && titleInvalid

          return (
            <Field key={field.key} data-invalid={invalid ? true : undefined}>
              <FieldLabel htmlFor={fieldId} className="sr-only">
                {field.label}
              </FieldLabel>
              <InputGroup>
                <InputGroupAddon align="block-start">
                  <field.icon />
                  <InputGroupText>{field.label}</InputGroupText>
                </InputGroupAddon>
                {field.multiline ? (
                  <InputGroupTextarea
                    id={fieldId}
                    value={state[field.key]}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                ) : (
                  <InputGroupInput
                    id={fieldId}
                    value={state[field.key]}
                    aria-invalid={invalid ? true : undefined}
                    onChange={(event) =>
                      setField(field.key, event.target.value)
                    }
                  />
                )}
              </InputGroup>
            </Field>
          )
        })}

        <FieldSeparator />

        <NoteInput
          value={state.note}
          onValueChange={(note) => setState((prev) => ({ ...prev, note }))}
        />

        <TagInput
          id="basics-item-tags"
          value={state.tags}
          onValueChange={(tags) => setState((prev) => ({ ...prev, tags }))}
        />
      </FieldGroup>

      {/* Sticky footer bleeding to the dialog's edges — same pattern as
          `ItemDetailDialog`'s `DetailFooter`, minus the actions menu. */}
      <footer className="sticky bottom-0 -mx-4 mt-2 -mb-4 flex items-center justify-end gap-2 border-t bg-popover px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={titleInvalid}>
          Save
        </Button>
      </footer>
    </>
  )
}
