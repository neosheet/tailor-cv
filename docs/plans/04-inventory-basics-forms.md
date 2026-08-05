# Add/Edit forms for the Basics pool

## Context

Every Inventory pool page is read-only today: `PoolPanel`'s **Add** button is
hard-`disabled` (`src/components/inventory/pool-panel.tsx:167-170`), the row-action
menu's **Edit** and **Delete** items are `disabled` (`src/components/inventory/
pool-table.tsx:253-267`, with the comment "View detail is live; edit and delete are
still disabled"), and `src/mocks/` has no `createItem`/`updateItem`/`deleteItem` —
the only existing mutator is `toggleFavorite` (`src/mocks/index.ts:86-97`).

This plan wires real add/edit forms for the **Basics pool only** — the six sub-pools
`name`, `headline`, `summary`, `contact`, `location`, `social`
(`docs/specs/02-inventory-data-model.md:112-118`). Basics is the smallest pool (no
nested `inventory_lines`, per `02-inventory-schema-diagram.md:138-140`) and the
result — the field-config pattern, the mutators, and two reusable components — is
what gets copied to the other 12 pool pages in a follow-up plan.

Every `inventory_items`/`inventory_lines` row carries `tags` and `note`
(`02-inventory-data-model.md:104-105,156-157`). Every future pool form needs the
identical tag-picker and note-field UI, so per CLAUDE.md's rule ("if you have to
write the same component twice, extract it — the second occurrence is the signal"),
this plan builds `TagInput` and `NoteInput` as standalone reusable components from
the start, not embedded in the Basics form.

## Allowed APIs (Phase 0 discovery)

Read: `docs/specs/02-inventory-data-model.md`, `02-inventory-schema-diagram.md`,
`01-app-taxonomy.md`, `src/pages/inventory/basics.tsx`, `src/components/inventory/
pool-page.tsx`, `pool-panel.tsx`, `pool-table.tsx`, `pool-columns.tsx`, `columns.tsx`,
`item-detail-dialog.tsx`, `tag-filter.tsx`, `src/mocks/index.ts`, `flatten.ts`,
`data/basics.ts`, `tags.ts`, `src/lib/tag-copy.ts`, `src/components/settings/
tag-dialogs.tsx`, `src/components/ui/input-group.tsx`, `field.tsx`, and the shadcn
`@shadcn/input-group` registry example.

**Basics field mapping** (`02-inventory-data-model.md:272-301`) — all on
`inventory_items`, none on `inventory_lines`:

| kind | `title` | `subtitle` | `summary` | `url` | `details` |
|---|---|---|---|---|---|
| `name` | full name | — | — | — | — |
| `headline` | headline text | — | — | — | — |
| `summary` | variant label (app-invented) | — | summary body | — | — |
| `contact` | variant label (app-invented) | email | — | contact URL | `phone`, `image` |
| `location` | city | region | — | — | `address`, `postalCode`, `countryCode` |
| `social` | network name | username | — | profile URL | — |

**Tags**: registry lives in `src/mocks/tags.ts` — `TAG_NAME_PATTERN = /^[a-z0-9]+$/`
(line 22), `listTags(): TagUsage[]` (line 74), `validateTagName(raw, {except?})`
(line 51). Names on `inventory_items.tags` must come from the registry only — "The
application only ever offers registry names" (`02-inventory-data-model.md:424-427`)
— no free-typing a new tag onto a row from this form.

**Tag-picker pattern to copy**: `src/components/inventory/tag-filter.tsx` — built on
the project's own `src/components/ui/combobox.tsx` primitives (`Combobox`,
`ComboboxChip(s)`, `ComboboxContent`, `useComboboxAnchor`), `MAX_SUGGESTIONS = 5`
prefix-match (lines 18, 46-52), chips via `ComboboxValue` render-prop (78-82).

**Note field**: no editing UI exists yet, only read-only display (`item-detail-
dialog.tsx:273-275`, `pool-table.tsx:306-312`). `Textarea`
(`src/components/ui/textarea.tsx`) is installed but unused elsewhere.

**Input Group**: already installed at `src/components/ui/input-group.tsx` — exports
`InputGroup`, `InputGroupAddon` (`align: "inline-start"|"inline-end"|"block-start"|
"block-end"`), `InputGroupButton`, `InputGroupText`, `InputGroupInput`,
`InputGroupTextarea`. Raw `Input`/`Textarea` must never go directly inside
`InputGroup` — always the `InputGroup*` wrapped versions. Composes with `Field` /
`FieldLabel` / `FieldDescription` / `FieldError` (`src/components/ui/field.tsx`);
`FieldDescription` is exported but has zero real usages yet — this plan is its first.
Validation state: `data-invalid="true"` on `Field` + `aria-invalid="true"` on the
`InputGroup*` control.

**No form library installed** — no `react-hook-form`, `zod`, or `@hookform/
resolvers` in `package.json`, and the `@shadcn/form` registry item for this style
(`base-nova`) is an empty stub. The existing form precedent in this codebase
(`tag-dialogs.tsx`'s `RenameTagDialog`) is plain `useState` + a validate-on-change
function + `Field`/`FieldError`, no library. **This plan follows that same
lightweight pattern** — six known fields per kind doesn't need a form library, and
CLAUDE.md's "don't add abstractions beyond what's needed" argues against pulling one
in for this.

**Mock write pattern to copy**: `src/mocks/tags.ts`'s `createTag`/`renameTag`/
`deleteTag` (module-level array mutation) and `toggleFavorite`
(`src/mocks/index.ts:86-97`, mutate in place + bump `updatedAt`). Re-render pattern:
`PoolPanel` already tracks a `favouriteVersion` counter as a `useMemo` dependency
(`pool-panel.tsx:104-120`) because `itemsOfKind()` mutates in place without changing
array identity — the same counter bump covers create/update/delete.

**Decisions this plan makes that the spec leaves open** (per discovery, `02-
inventory-data-model.md` specifies no required-field or format validation for
Basics — see "Open Points" `862-878`):
- `title` is required on every kind (it's the row's only always-shown label in
  tables and pickers); every other field is optional.
- No email/URL format validation on `contact`/`social` — `details`/`url` are
  unvalidated by spec design ("Acceptable while they are display-only",
  `02-inventory-data-model.md:862-867`).
- Delete is a hard splice from the mock array, not a `deleted_at` soft delete — soft
  delete (spec 08) is "Spec only," not implemented anywhere in mocks yet, so adding
  it just for Basics would be inconsistent with the rest of the app. Out of scope
  here, called out again below.
- Pick-one enforcement for the five non-`social` kinds is **not** this form's job —
  the spec places that constraint on CV selection, not on `inventory_items`
  (`02-inventory-data-model.md:124`): "a constraint on the selection layer, not on
  this table."

## Phase 1 — Mock write layer

`src/mocks/index.ts`, next to `toggleFavorite`:

```ts
export function createItem(
  kind: ItemKind,
  input: BasicsItemInput
): DbInventoryItem { ... }

export function updateItem(
  itemId: string,
  patch: BasicsItemInput
): DbInventoryItem { ... }

export function deleteItem(itemId: string): void { ... }
```

- `id`: `` `${kind}-${crypto.randomUUID().slice(0, 8)}` `` — mirrors the readable
  `kind-slug` ids already in `data/basics.ts` closely enough while guaranteeing
  uniqueness without a slug-collision check.
- `position`: `itemsOfKind(kind).length` (append at the end of the pool).
- Timestamps: `new Date().toISOString()` for both on create; bump only `updatedAt`
  on update — same as `toggleFavorite`.
- Tag validation: before writing, every name in `input.tags` must be in
  `listTags().map(t => t.name)` — throw if not. This is the client-side stand-in for
  `assert_tags_registered()` (`02-inventory-data-model.md:429-457`), which only
  exists as a Postgres trigger today.
- `deleteItem` splices the row out of the module-level `items` array.

Verification: a scratch script (or a temporary test) calling `createItem("name",
{title: "Test"})` then `itemsOfKind("name")` shows the new row at the end;
`updateItem`/`deleteItem` round-trip correctly; writing an unregistered tag throws.

## Phase 2 — `TagInput` (reusable)

New file `src/components/inventory/tag-input.tsx`. Copies the interaction pattern
from `tag-filter.tsx` (`Combobox` + `ComboboxChips` + `useComboboxAnchor`,
prefix-matched suggestions capped at 5) with two differences:
- Suggestion source is the **full registry** (`listTags()`), not a pool-filtered set.
- It's a controlled form field, not a session-persisted filter: props are
  `{ value: string[]; onValueChange: (tags: string[]) => void; id?: string }`.

No inline "create new tag" affordance — matches the spec rule that this UI only
ever offers registry names. Wrap in `Field`/`FieldLabel="Tags"` at the call site.

## Phase 3 — `NoteInput` (reusable)

New file `src/components/inventory/note-input.tsx`. `Field` + `FieldLabel="Note"` +
`InputGroup`/`InputGroupTextarea` + `FieldDescription="Private. Never exported or
shown on a CV."` (this plan's first real use of `FieldDescription`). Props:
`{ value: string | null; onValueChange: (note: string | null) => void; id?: string }`
— empty string normalizes to `null` on blur.

## Phase 4 — Basics item form dialog

New file `src/components/inventory/basics-item-dialog.tsx`.

- One `BasicsItemDialog` handles both add and edit via a `mode: "add" | "edit"` prop
  (`item?: DbInventoryItem` when editing). Shell copied from `ItemDetailDialog`
  (`Dialog`/`DialogContent sm:max-w-2xl`, sticky footer bleeding to the dialog edges)
  but the footer holds **Cancel** / **Save** buttons instead of the actions menu, and
  the body is editable fields instead of read-only `Field` rows.
- A field-config map, keyed by the six Basics `ItemKind`s, declares which of
  `title`/`subtitle`/`summary`/`url`/`details.phone`/`details.image`/
  `details.address`/`details.postalCode`/`details.countryCode` to render and their
  labels, per the mapping table above. Every field is `InputGroupInput` (or
  `InputGroupTextarea` for `summary`) inside `Field`/`FieldLabel`, in a `FieldGroup`.
  `url`/`email`-shaped fields (`contact.subtitle`, `contact.url`, `social.url`) get
  an `InputGroupAddon` with a lucide icon (`AtSignIcon`, `LinkIcon`) — the idiomatic
  Input Group use case.
- Plain `useState` for form values (see "no form library" decision above);
  `title` required, Save disabled while empty — same disable-while-invalid pattern
  as `RenameTagDialog` (`tag-dialogs.tsx:33-91`).
- `TagInput` and `NoteInput` render at the bottom of every kind's field set — this
  is the payoff of Phase 2/3 (built once, used by six kinds now, 12 more pools
  later).
- On submit, calls `createItem`/`updateItem` from Phase 1, then an `onSaved`
  callback (parent bumps its refresh counter and closes the dialog).

## Phase 5 — Wire into `PoolPanel` / `PoolTable`

Both components are shared across every pool page, not Basics-specific, so the
form is threaded through as an optional prop rather than hard-coded — pools without
a form config (everything but Basics, for now) keep today's disabled buttons
exactly as-is.

- `PoolPanel` gains an optional `itemForm` prop (the field-config + dialog for its
  kind). When present: **Add** button (`pool-panel.tsx:167-170`) becomes enabled and
  opens `BasicsItemDialog` in add mode; when absent, stays disabled as today.
- `PoolTable`'s row-action **Edit** (`pool-table.tsx:253-256`) opens the same dialog
  in edit mode; **Delete** (`pool-table.tsx:260-267`) opens a confirm `AlertDialog`
  modeled on `DeleteTagDialog` (`tag-dialogs.tsx:101-152`) before calling
  `deleteItem`.
- Refresh: mirror the existing `favouriteVersion` counter pattern
  (`pool-panel.tsx:104-120`) — bump it after create/update/delete so
  `itemsOfKind(kind)` is re-read and re-sorted.
- `basics.tsx` passes the field config for each of its six tabs.

## Phase 6 — Verification

1. `npm run typecheck`, `npm run lint` clean.
2. Dev server: for each of the six Basics tabs — add a row, edit it, verify tags
   (registry-only picker) and note save correctly, delete it (with confirm).
3. One desktop screenshot of the Basics page with a form dialog open; console clean.

## Reused, not rebuilt

- `Dialog`/`DialogContent` sticky-footer shell from `item-detail-dialog.tsx`.
- `Combobox` primitives and the prefix-match logic from `tag-filter.tsx`.
- `Field`/`FieldLabel`/`FieldError` composition and disable-while-invalid pattern
  from `tag-dialogs.tsx`.
- `favouriteVersion`-style refresh counter already in `pool-panel.tsx`.
- `AlertDialog` delete-confirm pattern from `DeleteTagDialog`.

## Out of scope

- The other 12 pool pages — each has nested `inventory_lines` (responsibilities,
  highlights, etc.), a materially bigger form problem than Basics' flat fields.
  Follow-up plan once this one is validated in the browser.
- Soft delete (`deleted_at`) — spec 08 is "Spec only," not implemented in mocks
  anywhere yet; this plan's `deleteItem` stays a hard splice for consistency with
  the rest of the app.
- Pick-one enforcement at CV-build time — belongs to the CV selection layer
  (spec 03), not this pool's CRUD.
- Bulk add/edit, CSV import — Import/Export stays a placeholder per plan 07.

Per CLAUDE.md, update `docs/progress.md` with a new row as phases land.
