# Add/edit/delete forms for the remaining Inventory pools

## Context

Spec: [`docs/specs/02-inventory-data-model.md`](../specs/02-inventory-data-model.md)
(field mapping, `inventory_lines`, `item_skills`). Precedent:
[`docs/plans/04-inventory-basics-forms.md`](04-inventory-basics-forms.md) (Basics
forms) and [`docs/plans/05-supabase-integration.md`](05-supabase-integration.md)
(the Supabase cutover that plan 04 predates).

Per `docs/progress.md` row 12, plan 04 built add/edit/delete for the six Basics
kinds and explicitly deferred "the other 12 pool pages — each has nested
`inventory_lines` ... a materially bigger form problem." This plan is that
follow-up, **for every remaining pool except `work`**: Education, Skills,
Languages, Interests, Projects, Publications, Awards, Certificates, References,
and Volunteer (10 kinds). `work` is deliberately excluded — same complexity as
Volunteer, but scoped out at the user's request to handle separately later.
Volunteer is explicitly **in** scope despite sharing Work's shape
(responsibilities/highlights lines + `item_skills` links) — a conscious
call made when scoping this plan, not an oversight.

**Explicit product decision for this plan: one shared dialog component, not
one per pool or a Basics-only one.** `src/components/inventory/
basics-item-dialog.tsx` is renamed to `item-dialog.tsx` and generalized
(`BasicsItemDialog` → `ItemDialog`, `BasicsItemForm` → `ItemForm`) to serve
Basics and all 10 new pools from one file, keyed by `ItemKind` instead of
`BasicsKind`. Nothing about Basics' behaviour changes — it keeps using the
same component, just no longer a separate one.

Since plan 04 landed, the app cut over from `src/mocks/` to real Supabase
(plan 05). `createItem`/`updateItem`/`deleteItem`/`toggleFavorite` in
`src/lib/inventory.ts` are async, take the `InventoryStore` as their first
argument, and mutate the store's React state on success — every selector
reading the store re-renders for free, no manual refresh counter needed
(confirmed: neither `basics.tsx` nor `pool-page.tsx` passes `onDataChanged`
to `PoolPanel` today; `rows={itemsOfKind(store, kind)}` alone is enough
because the parent re-renders when `store.items` changes). This plan builds
on `src/lib/inventory.ts` only — `src/mocks/` stays dead for everything but
`scripts/seed.ts` and the CVs cutover.

## Phase 0 — Discovery (current codebase, post-Supabase-cutover)

**`src/lib/inventory.ts` today** — `createItem`/`updateItem` only read/write
`title`/`subtitle`/`summary`/`url`/`details`/`tags`/`note`/`position`. They do
**not** touch `start_date`, `end_date`, or `years_experience` at all — those
columns exist on `inventory_items` (spec 02 lines 100-103) but no mutator
writes them yet, because Basics never needed to. **This plan's Phase 1 must
add all three** or every ranged/dated/skill-experience kind below silently
can't save that data. `BasicsItemInput` (`inventory.ts:150-158`) is the type to
extend and rename (see Phase 1) — `basics-item-dialog.tsx:52-55` is its only
non-`inventory.ts` importer today.

There are **no mutators for `inventory_lines` or `item_skills` anywhere** —
plan 04 explicitly scoped lines out, and nothing since has added them.
`inventory-store.tsx` already has `mapLineRow`/`mapItemSkillRow` for reads and
`setLines`/`setItemSkills` setters (`inventory-store.tsx:64-86,201-203`) — the
read half of the plumbing exists, only the write half is missing.

**`item-dialog.tsx` (current `basics-item-dialog.tsx`) shape to extend, not
rewrite** — `KIND_FIELDS: Record<BasicsKind, FieldConfig[]>` (line 87),
`KIND_LABELS: Record<BasicsKind, string>` (line 116), `FormState` (125),
`stateFromItem`/`buildInput` (144, 170), the dirty-tracking +
discard-confirmation `AlertDialog` in `BasicsItemDialog` (191-267), and the
field-rendering loop in `BasicsItemForm` (319-402) that already switches on
`field.multiline` for a `Textarea`-style field. All of this generalizes by
widening the `Record` key from `BasicsKind` to `ItemKend` minus `"work"`, and
adding new `FieldKey` variants + two new dialog sections (lines, skills) — the
dirty-tracking/discard/Save-disabled-while-invalid mechanics don't change.

**Wiring gaps found reading `pool-panel.tsx`, `pool-table.tsx`,
`item-detail-dialog.tsx`, `pool-page.tsx`**:
- `PoolPanel`'s `formKind?: BasicsKind` (`pool-panel.tsx:112`) gates Add
  (button `disabled={!formKind}`, line 205) and is passed straight to
  `BasicsItemDialog`. **Must widen to `ItemKind`** (still optional — pools
  with no config, i.e. `work`, pass nothing and keep today's disabled state).
- `pool-page.tsx` (used by all 10 target pools, one page each) **never passes
  `formKind` today** — every non-Basics pool page is 100% read-only right now
  for exactly this reason. This plan adds one line: pass `formKind={kind}`
  unless `kind === "work"`.
- `ItemDetailDialog`'s own footer has a **hard-`disabled` Delete menu item**
  (`item-detail-dialog.tsx:389`) that nothing wires up — `onEditRow` is
  threaded through from `PoolTable` (`pool-table.tsx:203-208`) but
  `onRequestDelete` is not, even though `PoolTable` already receives it as a
  prop for the row-action menu (`pool-table.tsx:86,191-197`). This plan closes
  that gap too, since it's the natural place to reach Delete from while
  reviewing an entry, and the confirm-dialog plumbing already exists one level
  up in `PoolPanel`.

**No date-picker component installed** (`src/components/ui/` has no
`calendar`/`popover` yet). Per shadcn's own docs
(`ui.shadcn.com/docs/components/base/date-picker`), shadcn has no standalone
"date picker" registry item — it's a documented **composition** of `Popover` +
`Calendar` (`Popover` → `PopoverTrigger` rendering a `Button` showing the
formatted date, `PopoverContent` holding a `Calendar`), using `date-fns`
(already a dependency, `package.json`) for formatting. `Calendar` is built on
React DayPicker and supports `captionLayout="dropdown"` for fast month/year
jumping, but — like any calendar — it always resolves a selection to a full
day. **Our dates are partial ISO** (`2014`, `2014-06`, or `2014-06-29`, spec
02 lines 133-138), so this plan adds one reusable component,
`PartialDatePicker` (`src/components/inventory/partial-date-picker.tsx`),
rather than using bare `Calendar` per date field:
- `npx shadcn@latest add calendar popover` first (two new `src/components/ui/`
  files, standard install, no customization needed).
- `Popover` + `PopoverTrigger` (`render={<Button variant="outline" />}`, the
  same `render`-prop pattern already used for `DropdownMenuTrigger` elsewhere
  in this codebase, e.g. `pool-table.tsx:276-283`) showing the current value
  via the existing `formatPartialDate` (`columns.tsx`) or a muted
  "Pick a date" placeholder, plus a small clear (×) button for nulling out an
  optional end date (ongoing).
- `PopoverContent` holds `Calendar mode="single" captionLayout="dropdown"` plus
  a 3-option `ToggleGroup` ("Year" / "Month" / "Day") for precision — fits
  shadcn's own rule that 2-7 option sets use `ToggleGroup`, not looped
  `Button`s. Selecting a day in the calendar combines with the toggled
  precision to produce the ISO string to store: full `yyyy-MM-dd` for "Day",
  `yyyy-MM` for "Month", `yyyy` for "Year" (via `date-fns`'s `format`).
  Precision defaults to whatever the existing value's own length implies when
  editing (4 chars → Year, 7 → Month, 10 → Day), or "Day" for a new value.
- Props: `{ value: string | null; onValueChange: (iso: string | null) => void; id?: string }` — same controlled-`string | null` shape `NoteInput` already uses, so it drops into `Field`/`FieldLabel` the same way every other field does.
- This replaces the plain-text-input approach: since the picker can only ever
  emit a validly-formatted partial-ISO string, no separate format validation
  is needed. The one check that remains client-side is **`end >= start`**
  when both dates are set (string comparison is safe — ISO partials sort
  chronologically as plain text, spec 02 line 695), surfaced as a
  `FieldError` under the end-date picker.

**No drag-and-drop library installed** (`package.json` — no `dnd-kit`, no
`react-beautiful-dnd`). Reordering nested lines uses **up/down icon buttons**,
not drag — consistent with CLAUDE.md's "don't add abstractions beyond what's
needed" and avoids a new dependency for a personal-scale list (a job's
highlights list is a handful of rows, not hundreds).

**Field mapping for the 10 in-scope kinds**, from spec 02's table
(`02-inventory-data-model.md:272-291`) — this is this plan's field-config
reference, the equivalent of plan 04's Basics table:

| kind | subtitle | summary | date mode | `details` keys | lines (`list_kind`) | `item_skills`? |
|---|---|---|---|---|---|---|
| `volunteer` | position | description | range | — | `responsibilities`, `highlights` | yes |
| `education` | area | — | range | `studyType`, `score` | `courses` | no |
| `skill` | level | — | none (has `years_experience` instead) | — | `keywords` | no |
| `language` | fluency | — | none | — | — | no |
| `interest` | — | — | none | — | `keywords` | no |
| `project` | — | description | range | `entity`, `type` | `highlights`, `keywords`, `roles` | yes |
| `award` | awarder | summary | single ("Awarded") | — | — | no |
| `certificate` | issuer | — | single ("Issued") | — | — | no |
| `publication` | publisher | summary | single ("Released") | — | — | no |
| `reference` | — | reference | none | — | — | no |

`item_skills` scope note: spec 02 (`02-inventory-data-model.md:176-180`) says
this link is for "the work / project / volunteer entry" — three kinds. `work`
is out of scope for this plan, so only `volunteer` and `project` get the skill
picker here; `work` gets it whenever that follow-up lands.

## Architecture

### Phase 1 — Extend `src/lib/inventory.ts`: dates, years of experience, lines, skill links

- Rename `BasicsItemInput` → `ItemInput` (it's no longer Basics-only; update
  its one external import in the dialog file). Add three optional fields:
  `startDate?: string | null`, `endDate?: string | null`,
  `yearsExperience?: number | null`.
- `createItem`: include `start_date: input.startDate ?? null`,
  `end_date: input.endDate ?? null`,
  `years_experience: input.yearsExperience ?? null` in the insert payload.
- `updateItem`: same `!== undefined` merge-patch pattern already used for
  `subtitle`/`summary`/etc. — add the three fields the same way.
- New line mutators, same shape as the item mutators (async, take `store`
  first, mutate `store.setLines` on success, validate tags via the existing
  `assertTagsRegistered`):
  ```ts
  export async function createLine(
    store: InventoryStore,
    itemId: string,
    listKind: LineKind,
    input: { content: string; tags?: string[]; note?: string | null }
  ): Promise<DbInventoryLine>

  export async function updateLine(
    store: InventoryStore,
    lineId: string,
    patch: { content?: string; tags?: string[]; note?: string | null; position?: number }
  ): Promise<DbInventoryLine>

  export async function deleteLine(store: InventoryStore, lineId: string): Promise<void>
  ```
  `position` on create = current `linesOf(store, itemId, listKind).length`
  (append), matching how `createItem` appends within its pool.
- New skill-link mutator — **full-replace**, not incremental diffing, because
  there's no reorder-in-place UI for this list (just add/remove + save), and
  `item_skills` has no soft-delete semantics to preserve (spec 02:
  "Links simply survive" refers to parent soft-delete, not to editing):
  ```ts
  export async function replaceItemSkills(
    store: InventoryStore,
    itemId: string,
    skillIds: string[]
  ): Promise<void>
  ```
  Implementation: `delete from item_skills where item_id = itemId`, then (if
  `skillIds.length > 0`) one `insert` of
  `skillIds.map((skillId, position) => ({ item_id, skill_id: skillId, position }))`.
  Update `store.setItemSkills` to splice out the old rows for `itemId` and
  splice in the new ones from the insert's returned rows.

**Verify**: `npm run typecheck` — new exports compile; grep confirms
`BasicsItemInput` has zero remaining references outside this file and the
renamed dialog.

### Phase 2 — `SkillLinkInput` (reusable)

New file `src/components/inventory/skill-link-input.tsx`. Copies `TagInput`'s
`Combobox` + `ComboboxChips` interaction (`tag-input.tsx:87-146`) with two
differences:
- Suggestion source is `itemsOfKind(store, "skill")` (title as the visible
  label, `id` as the value) — not the tag registry.
- **No "create new" affordance.** Typing something no suggestion matches and
  pressing Enter does nothing (unlike `TagInput`, which registers an
  unrecognised tag) — a skill link can only point at a real Skills-pool row,
  same reasoning as spec 02's "must be an item with `kind = 'skill'`"
  constraint (`02-inventory-data-model.md:185`). If the skill doesn't exist
  yet, the user adds it in the Skills pool first, same detour tags require
  before this plan existed.
- Props: `{ value: string[]; onValueChange: (skillIds: string[]) => void; id?: string }`, chips render the skill's `title`, not its id.

**Verify**: typecheck; manual check that suggestions exclude already-linked
skills and exclude the entry's own row (mirrors the DB's
`check (item_id <> skill_id)`, `02-inventory-data-model.md:218`) — filter
`itemsOfKind(store, "skill").filter(s => s.id !== currentItemId)` if editing a
skill-kind item (skills can't link to themselves, though skill-kind items
never get this section themselves since skill has no `item_skills` per the
table above — defensive only).

### Phase 3 — `PartialDatePicker` (reusable)

`npx shadcn@latest add calendar popover` first. New file
`src/components/inventory/partial-date-picker.tsx`:

- `Popover` / `PopoverTrigger` (`render={<Button variant="outline" />}`, same
  `render`-prop convention as `DropdownMenuTrigger` in `pool-table.tsx:276-283`)
  showing `formatPartialDate(value)` (`columns.tsx`) or a muted "Pick a date"
  placeholder, with a trailing clear (×) button when `value` is set (for
  nulling an optional end date).
- `PopoverContent` holds, top to bottom: a 3-option `ToggleGroup` ("Year" /
  "Month" / "Day") for precision, and `Calendar mode="single"
  captionLayout="dropdown"`.
- Selecting a day combines with the toggled precision via `date-fns`'s
  `format` to produce the stored ISO string — `"yyyy-MM-dd"` for Day,
  `"yyyy-MM"` for Month, `"yyyy"` for Year. Precision initializes from the
  incoming `value`'s length (4 → Year, 7 → Month, 10 → Day) and defaults to
  Day for a new/empty value.
- Props: `{ value: string | null; onValueChange: (iso: string | null) => void; id?: string }` — same controlled `string | null` shape as `NoteInput`, so `Field`/`FieldLabel` wraps it identically at every call site.
- No format validation needed here — the picker can only emit validly-shaped
  partial-ISO strings by construction. `ItemForm` (Phase 5) still needs its
  own `end >= start` check when both are set, since that's a relationship
  between two pickers' values, not a shape problem either one can catch alone.

**Verify**: typecheck; render standalone with a `2014-06` seed value, confirm
the popover opens with "Month" precision pre-selected and the trigger shows
"Jun 2014"; picking a new day under "Day" precision produces a full
`yyyy-MM-dd` string; clear button nulls the value.

### Phase 4 — `LineListEditor` (reusable)

New file `src/components/inventory/line-list-editor.tsx`. Renders one
`list_kind`'s rows as an editable list:

- Each row: a `Field`-wrapped `InputGroupInput`/`InputGroupTextarea` for
  `content` (required, Save disabled while any row is empty — same
  invalid-state pattern as `title` in the existing dialog), an up/down
  icon-button pair (disabled at the ends) that swaps the row with its
  neighbour, and a delete icon button that removes the row from local state.
- Tags/note per row sit inside a closed-by-default `Collapsible`
  (`src/components/ui/collapsible.tsx`, already installed, unused elsewhere)
  triggered by a small "Tags & note" toggle — keeps a list of 8 highlights
  scannable while still exposing `TagInput`/`NoteInput` per row without a new
  component.
- An "Add" button appends an empty row (no `id` yet — see save-time diffing
  below).
- Props: `{ listKind: LineKind; label: string; value: LineDraft[];
  onValueChange: (lines: LineDraft[]) => void }` where
  `LineDraft = { id?: string; content: string; tags: string[]; note: string | null }`
  — `id` present means "existing row, diff against original on save",
  absent means "new row, create on save."
- Purely a controlled local-state component — it does not call
  `createLine`/`updateLine`/`deleteLine` itself. `ItemDialog`'s save handler
  (Phase 4) diffs the before/after arrays and issues the calls, same division
  of responsibility as the flat fields (`buildInput` composes a patch,
  `handleSave` sends it).

**Verify**: typecheck; render with a mix of existing (`id` set) and freshly
added (`id` unset) rows, confirm reorder buttons and delete work on local
state without touching the network.

### Phase 5 — Rename and generalize the dialog

`src/components/inventory/basics-item-dialog.tsx` →
`src/components/inventory/item-dialog.tsx`. `BasicsItemDialog` → `ItemDialog`,
`BasicsItemForm` → `ItemForm`. Behavioural changes, everything else (dirty
tracking, discard-confirm `AlertDialog`, Save-disabled-while-title-empty)
carries over unchanged:

- `KIND_FIELDS` becomes `Record<Exclude<ItemKind, "work">, FieldConfig[]>`,
  extended per the Phase 0 mapping table — new `FieldKey` variants for
  `startDate`/`endDate` (rendered via `PartialDatePicker` from Phase 3, not a
  text input; label varies for single-date kinds — "Awarded"/"Issued"/
  "Released" — vs. "Start date"/"End date" for ranged ones),
  `yearsExperience` (number input), and the `details` keys
  `studyType`/`score`/`entity`/`type`. Reuses the same `InputGroup*` +
  `Field`/`FieldLabel` composition already in the file for everything except
  the date fields, which use `PartialDatePicker` directly inside `Field`
  (it isn't an `InputGroup*` control, same as how `TagInput`/`NoteInput`
  already sit directly inside `Field` today).
- `KIND_LABELS` extended to all 10 new kinds (lowercase, e.g. `"volunteer
  entry"`, `"project"`) for the "Add {label}"/"Edit {label}" title and the
  discard-confirm copy.
- Two new optional dialog sections, rendered after the flat `FieldGroup` and
  before the Tags/Note footer panel, present only when the kind's config
  calls for them (per the mapping table):
  - One `LineListEditor` per `list_kind` the kind uses (e.g. `volunteer` gets
    two — `responsibilities` and `highlights` — in that order, matching
    `LINE_ORDER` in `item-detail-dialog.tsx:83-89`).
  - One `SkillLinkInput` for `volunteer`/`project`, labelled "Skills used."
- `stateFromItem`/`buildInput` extended for the new flat fields. Save is
  disabled when an end-date `PartialDatePicker`'s value sorts before the
  start date's (plain string comparison, per spec 02 line 695) — surfaced as
  a `FieldError` under the end-date field, same disabled-Save wiring as the
  existing `title`-required check.
- `ItemForm`'s local state gains `lines: Partial<Record<LineKind, LineDraft[]>>`
  and `skillIds: string[]`, seeded from `allLinesOf`/`skillsOf` in edit mode
  (empty in add mode).
- `handleSave` becomes, in order:
  1. `const item = mode === "edit" ? await updateItem(store, item.id, input) : await createItem(store, kind, input)` — same as today, now carrying the extended `ItemInput`.
  2. For each configured `list_kind`: diff `state.lines[kind]` against the
     original (`id` present + changed → `updateLine`; `id` present + removed
     from array → `deleteLine`; no `id` → `createLine`), each call scoped to
     `item.id` (the just-created id in add mode).
  3. If the kind has skill links: `await replaceItemSkills(store, item.id, state.skillIds)`.
  4. `onSaved()`.

**Verify**: `npm run typecheck` — every kind in `KIND_FIELDS` type-checks
against `Exclude<ItemKind, "work">`; `npm run lint` clean.

### Phase 6 — Wire the shared infra through to every pool

- `pool-panel.tsx`: widen `formKind?: BasicsKind` → `formKind?: ItemKind`;
  swap the `BasicsItemDialog` import/usage for `ItemDialog`. No other change —
  the component was already generic over "is a form config present," it just
  had too narrow a type.
- `pool-page.tsx`: pass `formKind={kind === "work" ? undefined : kind}` to
  `PoolPanel` (currently passes nothing at all). This alone turns on
  Add/Edit/Delete for all 10 target pools' pages — `basics.tsx` is untouched
  (still explicitly passes `formKind={pool.kind}` per tab) and `work.tsx`
  keeps today's fully-disabled behaviour.
- `item-detail-dialog.tsx` / `pool-table.tsx`: thread `onRequestDelete`
  through to `ItemDetailDialog` the same way `onEditRow` already is
  (`pool-table.tsx:203-208`) — closing the detail dialog before handing off to
  the confirm `AlertDialog`, same pattern as the existing
  detail-then-edit handoff. Replace the hard `disabled` on the footer's Delete
  menu item (`item-detail-dialog.tsx:389`) with `disabled={!onRequestDelete}`
  wired to it, matching the Edit item right above it.

**Verify**: `npm run typecheck && npm run lint` clean on the full repo.

### Phase 7 — Verification

1. `npm run typecheck && npm run lint` clean.
2. Browser pass, one flat pool and one nested-list pool (per CLAUDE.md's
   "keep the visual check simple" — not all 10 individually need a
   screenshot, but every pool needs its round-trip exercised):
   - **Award** (flat, single date, no lines/skills): add, edit, tag, note,
     delete.
   - **Volunteer** (dates range + two line kinds + skill links): add an
     entry, add/reorder/delete highlights and responsibilities, link and
     unlink a skill, edit, delete.
   - Spot-check the remaining 8 pools' Add button opens with the right
     fields for that kind (Education shows `studyType`/`score` + courses;
     Skills shows years-of-experience + keywords; Projects shows
     `entity`/`type` + three line kinds + skills; Languages/Certificates/
     Publications/References/Interests show their flat/near-flat sets).
   - Confirm `work.tsx` is unaffected — Add/Edit/Delete still disabled there.
3. One desktop screenshot each of Award's and Volunteer's dialogs open;
   console clean.

## Reused, not rebuilt

- `ItemDialog`'s dirty-tracking, discard-confirm `AlertDialog`, and
  Save-disabled-while-invalid pattern — already in the file being renamed,
  unchanged in shape.
- `TagInput`/`NoteInput` — used as-is, both at the item level (already wired)
  and now per line row inside `LineListEditor`.
- `Collapsible` (`src/components/ui/collapsible.tsx`) — installed, unused
  until now; used for per-line tags/note disclosure.
- `AlertDialog` delete-confirm already in `PoolPanel` — `ItemDetailDialog`'s
  Delete just needs to call the same `onRequestDelete` prop, not a new one.
- `formatPartialDate` in `columns.tsx` — reused by `PartialDatePicker`'s
  trigger label instead of a second formatting implementation.
- shadcn's own documented `Popover` + `Calendar` composition
  (`ui.shadcn.com/docs/components/base/date-picker`) and `date-fns`, already a
  dependency — `PartialDatePicker` adds only a precision `ToggleGroup` on top,
  not a new date-formatting library or a hand-rolled calendar grid.

## Out of scope

- **`work`** — deliberately deferred, per this plan's scoping decision.
- Drag-and-drop reordering of lines, or of entries within a pool — up/down
  buttons only; no new dependency for this pass.
- Per-skill "which entries use this" reverse view in the detail dialog
  (`entriesUsingSkill` already exists as a selector) — a nice-to-have, not
  requested here.
- Soft delete — still "Spec only" (spec 08); `deleteItem`/`deleteLine` stay
  hard deletes, consistent with Basics.
- Bulk add/edit, CSV import/export — unchanged placeholders.
- Pool-level manual reordering (favourite-first is the only sort Inventory
  has today) — unaffected by this plan.

Per CLAUDE.md, update `docs/progress.md` with a new row as phases land.
