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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
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
  // Lifted above `BasicsItemForm` because closing can be triggered from outside
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
          <BasicsItemForm
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

function BasicsItemForm({
  kind,
  mode,
  item,
  onDirtyChange,
  onRequestClose,
  onSaved,
}: {
  kind: BasicsKind
  mode: "add" | "edit"
  item?: DbInventoryItem
  onDirtyChange: (dirty: boolean) => void
  onRequestClose: () => void
  onSaved: () => void
}) {
  const [initialState] = React.useState<FormState>(() =>
    mode === "edit" && item ? stateFromItem(item) : EMPTY_STATE
  )
  const [state, setState] = React.useState<FormState>(initialState)

  const fields = KIND_FIELDS[kind]
  const titleInvalid = state.title.trim() === ""

  React.useEffect(() => {
    onDirtyChange(JSON.stringify(state) !== JSON.stringify(initialState))
    // `initialState` and `onDirtyChange` are stable for this dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

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
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "add" ? "Add" : "Edit"} {KIND_LABELS[kind]}
        </DialogTitle>
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4">
        <FieldGroup>
          {fields.map((field) => {
            const fieldId = `basics-item-${field.key}`
            const invalid = field.key === "title" && titleInvalid

            return (
              <Field key={field.key} data-invalid={invalid ? true : undefined}>
                <FieldLabel htmlFor={fieldId} className="sr-only">
                  {field.label}
                </FieldLabel>
                <InputGroup>
                  {field.multiline ? (
                    <>
                      <InputGroupAddon align="block-start">
                        <field.icon />
                        <InputGroupText>{field.label}</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupTextarea
                        id={fieldId}
                        value={state[field.key]}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      />
                    </>
                  ) : (
                    <>
                      <InputGroupAddon>
                        <field.icon />
                      </InputGroupAddon>
                      <InputGroupInput
                        id={fieldId}
                        placeholder={field.label}
                        value={state[field.key]}
                        aria-invalid={invalid ? true : undefined}
                        onChange={(event) =>
                          setField(field.key, event.target.value)
                        }
                      />
                    </>
                  )}
                </InputGroup>
              </Field>
            )
          })}
        </FieldGroup>

        {/* Secondary area: fields every kind shares (unlike the ones above,
          which vary per kind) get their own muted panel so they read as
          metadata about the row rather than part of the main form. */}
        <FieldGroup className="-mx-4 mt-4 w-auto border-t bg-muted/50 px-4 py-4">
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
      </DialogBody>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onRequestClose}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSave} disabled={titleInvalid}>
          Save
        </Button>
      </DialogFooter>
    </>
  )
}
