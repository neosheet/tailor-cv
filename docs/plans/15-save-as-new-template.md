# 15 — Save as new template

Implements [docs/specs/13-save-as-new-template.md](../specs/13-save-as-new-template.md).
**This plan is self-contained** — the executing session will not have this planning
session's conversation. Every decision below is final, not a suggestion to
re-litigate. Read this whole file before touching code.

## Why (context a fresh session needs)

A CV's Style/Page/Block Settings tabs (`src/components/cv/persona-field-tree.tsx`)
write per-CV overrides into `cvs.template_settings` (a `TemplateSettings` JSON blob —
see `src/lib/cv-template-schema.ts`), layered at render time on top of one of the
four built-in `TemplateDefinition`s in `src/lib/cv-template-defs/*.ts`
(registered in `src/lib/cv-templates.ts`'s `cvTemplates` array). That delta is scoped
to one CV — there's no way to lift "this layout, as edited" onto a second CV without
manually reproducing every override.

This plan adds a `cv_templates` Supabase table (one row per user-saved,
fully-resolved `TemplateDefinition`), a "Save as new template" button + dialog on
the CV edit page, and wires the resulting saved templates into every place a
built-in template is currently selectable/renderable.

## Locked-in decisions (from the spec — do not re-open)

1. **A saved template is a standalone, complete `TemplateDefinition`**, not a
   `(base template id, template_settings)` pair. This follows the format's own
   "one definition is one file, nothing resolves against another file at render
   time" rule (spec 07). The CV's current `template_settings` gets *baked* into a
   copy of the base definition at save time.
2. **Saving does not modify the CV being edited.** It stays on its original base
   template id with its `template_settings` intact and still editable. This is a
   copy-out, producing a new artifact for *other* CVs — not a rebind.
3. **The dialog collects `name` and `description` only.** `density`/`atsSafe`/
   `bestFor` are not user-facing here — baked definitions default
   `density: "Balanced"`, `atsSafe: false`, `bestFor: ""`.
4. **No management UI for saved templates in this plan** (no rename/delete/re-edit).
   A saved template is picked and rendered exactly like a built-in; only the save
   path and the read/selection paths are in scope.
5. **`cvs.template_id` stays `text`.** A saved template's `uuid` id is written into
   that column as a string — no schema change to `cvs`, no new FK. Built-in ids
   (`"classic"`, `"two-column"`, `"batch1-demo"`) and saved-template uuids share
   the column without collision (uuids never match the hardcoded literal ids).

## Current-state summary (confirmed via direct file reads, not assumed)

- **`TemplateDefinition` (schemaVersion 2)** — `src/lib/cv-template-schema.ts`.
  `templateDefinitionSchema`/`parseTemplateDefinition` already validate it at
  runtime; reuse both as-is for a saved row's `definition` jsonb column.
- **`TemplateSettings`** (same file, lines 127-141): `{ styles?: Record<string,
  Style>; page?: Partial<PageConfig>; nodes?: Record<string, { hidden?: boolean;
  styles?: string | string[]; text?: string }> }`.
- **Five call sites read `cvTemplates` directly today** (`cvTemplates.find(t => t.id
  === id) ?? cvTemplates[0]` or similar):
  - `src/lib/cv.ts:61-63` (`resolveCv`, the print/preview resolver)
  - `src/components/cv/templates/index.tsx:41` (`TemplateRender`, the actual
    render-time lookup — every printed/previewed live CV goes through this)
  - `src/components/cv/cv-list-panel.tsx:85` (row → template) and `:104`
    (`templateOptions` fed into `CvFormDialog`'s Template `Select`)
  - `src/components/cv/templates-panel.tsx:23` and `:60` (gallery)
  - `src/pages/personas.tsx:77`, `src/pages/persona-detail.tsx:347` (unrelated to
    this plan — Persona pages use `cvTemplates` only for an unrelated preview
    picker; **do not touch these two**, out of scope, see below)
- **`cv-template-core.ts`** already has the exact node-walking pattern
  (`collectBlockNodeIds`, lines 203-278) `bakeTemplateSettings` needs to mirror:
  dispatch on `"repeat" in node` / `"block" in node` / `"if" in node` / `"join" in
  node` / else-element, recursing into `blocks[target].node` with a `pathVisited`
  cycle guard. Also has `resolveStyleObject`/`flattenStyle` for style resolution
  (not directly reused — baking styles is a simpler shallow-merge, no flattening
  needed since `extends` chains stay intact in the output).
- **`PersonaStoreProvider`** (`src/lib/persona-store.tsx`) fetches `personas`,
  `persona_sections`, `persona_items`, `persona_lines`, `cvs` once per session into
  `React.useState`, exposed via `PersonaStore`. New `cvTemplates`/`setCvTemplates`
  follow this exact pattern (see Phase 2).
- **`CvFormDialog`** (`src/components/cv/cv-form-dialog.tsx`) is the closest
  reference for the new Save dialog: `wasOpen` reset-on-open-transition pattern
  (lines 81-91), `Field`/`FieldGroup`/`FieldLabel` + `InputGroup`/`InputGroupAddon`/
  `InputGroupInput` layout, `saving` boolean disabling Cancel/Confirm + label swap
  to "Saving…", `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogBody`/
  `DialogFooter` structure. The new dialog is simpler (two fields, no `Select`s).
- **`PersonaFieldTree`** (`src/components/cv/persona-field-tree.tsx:991-1036`) is
  the CV edit page's tab container (`Card` > `CardContent` > `Tabs`). Receives
  `cv: DbCv` and `template: CvTemplate` as props — both already in scope for the
  new button. `isFrozen = cv.personaId === null` gates the Visibility/Data tabs;
  the new button should **also** be hidden when frozen (an imported/frozen CV's
  `template_settings` still exists but its `personaId` is null — baking still
  works technically, but see Phase 4's placement, which naturally excludes it by
  living beside Style/Page/Block, which frozen CVs do still show — no extra gating
  needed beyond the overrides-exist check itself).
- **shadcn primitives already installed**, confirmed present in `src/components/
  ui/`: `dialog.tsx`, `field.tsx` (`Field`/`FieldGroup`/`FieldLabel`), `input-
  group.tsx` (`InputGroup`/`InputGroupAddon`/`InputGroupInput`), `textarea.tsx`.
  No new shadcn component needed.
- **Migration conventions**: latest migration is
  `20260811030000_add_application_archived_at.sql` — next timestamp must sort
  after that. `touch_updated_at()` trigger function already exists (defined in
  `20260805193854_inventory_schema.sql`/`20260805193855_cv_schema.sql`) — reuse
  via `create trigger touch before update on cv_templates for each row execute
  function touch_updated_at();`, don't redefine it. RLS pattern to match
  (`applications` table, `20260810130000_add_applications.sql:16-46`):
  `user_id uuid not null references profiles(id) on delete cascade`, `enable row
  level security`, `for all to authenticated using (auth.uid() = user_id) with
  check (auth.uid() = user_id)`.
- **`Json` type** — `src/lib/database.types.ts`, imported as `import type { Json }
  from "@/lib/database.types"` in `cv.ts:7`; `jsonb` columns are written as `next as
  unknown as Json` (see `saveCvTemplateSettings`, `cv.ts:366`) and read back via a
  cast in the row mapper (`mapCvRow`, `persona-store.tsx:124`).

## Data model

### New type (`src/mocks/types.ts`)

Add near `DbCv` (after line 226, before `SourceCv`):

```ts
export type DbCvTemplate = DbTimestamps & {
  id: string
  userId: string
  name: string
  description: string
  schemaVersion: number
  definition: TemplateDefinition
}
```

(`DbTimestamps` and the `TemplateDefinition` import already exist in this file —
confirm the import line for `TemplateDefinition` is present; add it if not.)

### Migration

New file `supabase/migrations/20260811040000_add_cv_templates.sql`:

```sql
-- User-saved, standalone TemplateDefinitions produced by "Save as new
-- template" (docs/specs/13-save-as-new-template.md). Each row is a complete,
-- self-contained TemplateDefinition (schemaVersion 2) — never a delta on top
-- of a built-in template — matching every built-in's own self-containment
-- rule (docs/specs/07-cv-template-pdf-format.md).

create table cv_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  schema_version integer not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch before update on cv_templates
  for each row execute function touch_updated_at();

alter table cv_templates enable row level security;

create policy "own cv_templates" on cv_templates
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on cv_templates (user_id);
```

Apply live via Supabase MCP (`apply_migration`) against the project this repo is
wired to, then regenerate `src/lib/database.types.ts`
(`generate_typescript_types`) — same convention as every prior migration in this
repo (e.g. plan 12, Phase 1). Confirm `get_advisors` shows no new findings beyond
the pre-existing ones already noted in `docs/progress.md`.

## Phase 1 — Database migration

1. Write and apply the migration above exactly as specified.
2. Regenerate `database.types.ts`. Verify `Tables<"cv_templates">` appears with
   `id`, `user_id`, `name`, `description`, `schema_version`, `definition` (typed
   `Json`), `created_at`, `updated_at`.

## Phase 2 — Store + data layer

1. `src/mocks/types.ts`: add `DbCvTemplate` as specified above.
2. `src/lib/persona-store.tsx`:
   - `PersonaData`: add `cvTemplates: DbCvTemplate[]`.
   - `PersonaStore`: add `setCvTemplates: React.Dispatch<React.SetStateAction<DbCvTemplate[]>>`.
   - Add `mapCvTemplateRow(row: Tables<"cv_templates">): DbCvTemplate`:
     ```ts
     export function mapCvTemplateRow(row: Tables<"cv_templates">): DbCvTemplate {
       return {
         id: row.id,
         userId: row.user_id,
         name: row.name,
         description: row.description,
         schemaVersion: row.schema_version,
         definition: parseTemplateDefinition(row.definition),
         createdAt: row.created_at,
         updatedAt: row.updated_at,
       }
     }
     ```
     (`parseTemplateDefinition` import from `@/lib/cv-template-schema` — new
     import in this file. Mirrors `mapCvRow`'s `parseCvSnapshot` cast-then-
     validate pattern, `persona-store.tsx:126`, rather than a blind cast — a
     stored `TemplateDefinition` should fail loudly on read if corrupt, same
     reasoning as spec 07's open point 1.)
   - `PersonaStoreProvider`: add `const [cvTemplates, setCvTemplates] =
     React.useState<DbCvTemplate[]>([])`. In the `load()` effect's
     `Promise.all`, add a fifth query: `supabase.from("cv_templates").select("*")
     .eq("user_id", userId as string).order("created_at")`, alongside the
     existing `cvsResult`. Check its `.error`, map via `mapCvTemplateRow`, `set
     CvTemplates(...)`. Add `cvTemplates`/`setCvTemplates` to the memoized
     `value` and its dependency array.
3. New `src/lib/cv-template-bake.ts`:
   ```ts
   import type {
     BlockDef,
     PageConfig,
     Style,
     StyleDef,
     TemplateDefinition,
     TemplateNode,
     TemplateSettings,
   } from "@/lib/cv-template-schema"

   /**
    * Produces a standalone TemplateDefinition with `settings` fully applied —
    * the result renders identically with no `settings` passed at all. See
    * docs/specs/13-save-as-new-template.md's "Baking template_settings into a
    * standalone definition".
    */
   export function bakeTemplateSettings(
     definition: TemplateDefinition,
     settings: TemplateSettings
   ): TemplateDefinition {
     const page: PageConfig = { ...definition.page, ...settings.page }

     const styles: Record<string, StyleDef> = { ...definition.styles }
     for (const [name, override] of Object.entries(settings.styles ?? {})) {
       styles[name] = { ...styles[name], ...override }
     }

     const nodeOverrides = settings.nodes ?? {}
     const blocks: Record<string, BlockDef> = {}
     for (const [name, def] of Object.entries(definition.blocks)) {
       blocks[name] = { ...def, node: bakeNode(def.node, nodeOverrides) }
     }
     const root = bakeNode(definition.root, nodeOverrides)

     return { ...definition, page, styles, blocks, root: root ?? definition.root }
   }
   ```
   Then add the recursive `bakeNode` helper implementing Phase 2's node-shape
   rules below it in the same file. **Read `collectBlockNodeIds` in
   `cv-template-core.ts:203-278` first** — mirror its exact dispatch order
   (`"repeat" in node` → `"block" in node` → `"if" in node` → `"join" in node` →
   element) and its `id`-to-block-scope semantics, since baking must patch the
   *same* node a Block Settings override would have targeted at render time
   (`template-node-renderer.tsx`'s `applyNodeOverride` — read that function too,
   it is the render-time twin of what baking does statically):
   - **`hidden: true`**: the node is removed from its parent slot. For a node
     inside a `children` array, filter it out (and drop the array key entirely
     if it becomes empty, matching the empty-propagation rule — an absent
     `children` key still renders as a normal empty element per spec 07, so
     this is `children: filtered.length > 0 ? filtered : undefined`, not
     `children: []`). For a node that *is* a `then`/`else`/`separator`/`repeat.
     separator` slot value, that slot becomes `undefined` on the parent (an
     `IfNode` with no `else` already has optional `else`; a `RepeatNode` with
     no `separator` already has optional `separator` — no extra type change
     needed). A node with `id` that is itself the `root` or a `blocks[name].
     node` and gets `hidden: true` renders as `undefined` — guard this: `root`
     must always resolve to *something* (fall back to an empty `{ tag: "div" }`
     element rather than `undefined`, since `TemplateDefinition.root` is
     required, non-optional).
   - **`styles`**: concatenate onto the node's own `styles` field. Node's
     `styles` is `string | string[] | undefined`; normalize both sides to an
     array, concatenate, collapse back to a single string if length 1 (keeps
     the output's shape close to hand-authored definitions, matches how
     `setCvNodeOverride`'s caller in `persona-field-tree.tsx:931-933` always
     passes a single string today anyway).
   - **`text`**: overwrite the node's own `text` field directly (only
     meaningful on an `ElementNode`, which is exactly what `hasLiteralText`
     already restricts the Block tab's Text control to — `current.hasText`,
     `persona-field-tree.tsx:938`).
   - For a `repeat`/`block` node's override (per `collectBlockNodeIds`'s
     comment at `cv-template-core.ts:242-244`): a `styles`/`text` override on a
     `block`-shaped node patches the **instantiated block's own root node**,
     not the wrapper — read `template-node-renderer.tsx`'s
     `renderBlockInstance` to confirm the exact mechanism before implementing,
     and replicate it: baking must patch `blocks[target].node`, not the
     `BlockInstanceNode` itself, for this case. **This is the one part of
     `bakeTemplateSettings` most likely to need iterating against the real
     built-in definitions (`classic.ts` in particular, which has the richest
     `blocksSchema`/node-id set) — write a throwaway unit test (Phase 6) using
     a real built-in as fixture before trusting this by inspection alone.**

## Phase 3 — Mutator: saving a new template

New function in `src/lib/cv.ts` (add near the other mutators, after
`resetCvNodeOverride`):

```ts
export type SaveAsNewTemplateFields = {
  name: string
  description: string
}

/**
 * Bakes `cv`'s current `template_settings` onto `base`'s definition and
 * inserts the result as a new, standalone `cv_templates` row. Does not
 * modify `cv` itself — see docs/specs/13-save-as-new-template.md, "On
 * submit."
 */
export async function saveAsNewTemplate(
  store: PersonaStore,
  cv: DbCv,
  base: CvTemplate,
  fields: SaveAsNewTemplateFields
): Promise<DbCvTemplate> {
  const userId = requireUserId(store)
  const baked = bakeTemplateSettings(base.definition, cv.templateSettings)
  const definition: TemplateDefinition = {
    ...baked,
    id: crypto.randomUUID(),
    name: fields.name,
    description: fields.description,
    density: "Balanced",
    atsSafe: false,
    bestFor: "",
  }

  const { data, error } = await supabase
    .from("cv_templates")
    .insert({
      user_id: userId,
      name: fields.name,
      description: fields.description,
      schema_version: definition.schemaVersion,
      definition: definition as unknown as Json,
    })
    .select()
    .single()

  if (error) throw error

  const saved = mapCvTemplateRow(data)
  store.setCvTemplates((current) => [...current, saved])

  return saved
}
```

Imports to add at the top of `cv.ts`: `bakeTemplateSettings` from
`@/lib/cv-template-bake`, `mapCvTemplateRow` from `@/lib/persona-store` (already
imports `mapCvRow` from there, same module), `DbCvTemplate` from `@/mocks/types`,
`TemplateDefinition` from `@/lib/cv-template-schema`. `definition.id` uses
`crypto.randomUUID()` (Web Crypto, available in every browser this Vite SPA
targets — no new dependency) rather than reusing the `cv_templates.id` the insert
generates, since the definition needs *some* id at construction time before the
insert returns one; **this creates a harmless mismatch** between
`TemplateDefinition.id` (a fresh random uuid) and the `cv_templates.id` primary
key (a separately-generated `gen_random_uuid()` from the `insert().select()`
round-trip) — acceptable because nothing reads `TemplateDefinition.id` for a
saved template; every lookup in Phase 5 keys off `cv_templates.id`
(`DbCvTemplate.id`), never `definition.id`. Do not try to reconcile the two ids.

## Phase 4 — UI: button + dialog on the CV edit page

1. New `src/components/cv/save-as-new-template-dialog.tsx`
   (`SaveAsNewTemplateDialog`): pattern-matched on `CvFormDialog` (read it in
   full first, `src/components/cv/cv-form-dialog.tsx`) but simpler — two
   fields, no `Select`s:
   ```tsx
   export function SaveAsNewTemplateDialog({
     open,
     onOpenChange,
     onSubmit,
   }: {
     open: boolean
     onOpenChange: (open: boolean) => void
     onSubmit: (fields: { name: string; description: string }) => Promise<void>
   }) {
   ```
   State: `name`/`description`/`saving`, same `wasOpen` reset-on-open-transition
   pattern as `CvFormDialog` lines 81-91 (reset both fields to `""` on the open
   transition — this dialog has no "initial value" concept, it's always a fresh
   save). Layout: `Dialog` > `DialogContent` > `DialogHeader`/`DialogTitle`
   ("Save as new template") > `DialogBody` with a `FieldGroup` containing:
   - `Field` + `FieldLabel htmlFor="template-name"` ("Name", not `sr-only` this
     time — description below needs its own visible label too, unlike
     `CvFormDialog`'s single-field icon-`InputGroup` treatment) +
     `InputGroupInput` (or plain `Input`, either is fine — `InputGroup` is not
     required when there's no icon; using plain `Input` here is simpler and
     still shadcn-only).
   - `Field` + `FieldLabel htmlFor="template-description"` ("Description") +
     `Textarea` (already installed, confirmed present — use it here since a
     template description is more naturally multi-line than a CV's single-line
     note).
   `DialogFooter`: Cancel (`variant="ghost"`, disabled while `saving`) + Save
   (disabled while `saving` or `name.trim() === ""`, label `saving ? "Saving…" :
   "Save"`).
2. `src/components/cv/persona-field-tree.tsx`:
   - Import `saveAsNewTemplate` from `@/lib/cv`, `SaveAsNewTemplateDialog` from
     `./save-as-new-template-dialog`, `usePersonaStore` (already imported).
   - In `PersonaFieldTree`, compute:
     ```ts
     const hasOverrides =
       Object.keys(cv.templateSettings.styles ?? {}).length > 0 ||
       Object.keys(cv.templateSettings.page ?? {}).length > 0 ||
       Object.keys(cv.templateSettings.nodes ?? {}).length > 0
     const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false)
     const personaStore = usePersonaStore()
     ```
   - Render a `Button` (`variant="outline"`, `size="sm"`) reading "Save as new
     template", visible only when `hasOverrides`, placed inside the existing
     `TabsList` row's flex container — the `TabsList` currently sits alone
     inside `<Tabs>` at `mx-2 mt-2 w-fit self-start`; wrap it in a flex row
     (`<div className="mx-2 mt-2 flex items-center justify-between gap-2">`)
     with the existing `TabsList` (drop its own `mx-2 mt-2` since the wrapper
     now owns that spacing) on the left and the new `Button` on the right, only
     rendered when `hasOverrides`. `onClick={() => setSaveTemplateOpen(true)}`.
   - Render `<SaveAsNewTemplateDialog open={saveTemplateOpen}
     onOpenChange={setSaveTemplateOpen} onSubmit={async (fields) => {
     await saveAsNewTemplate(personaStore, cv, template, fields) }} />` after
     the `Tabs` closing tag, inside the `CardContent`.
   - No toast/confirmation system exists elsewhere in this codebase for
     "action succeeded" (confirmed absent during Phase 0 research — mutators
     throughout `cv.ts` just resolve/reject); closing the dialog on success
     (already handled inside `SaveAsNewTemplateDialog`'s `handleSubmit`, same
     `onOpenChange(false)` pattern as `CvFormDialog`) is the only feedback,
     consistent with the rest of this codebase's mutation UX.

## Phase 5 — Wiring saved templates into every selection/render path

Add one new helper, `findTemplate`, to `src/lib/cv-templates.ts` (**not** to
`cv.ts` — this keeps template *resolution* logic colocated with the registry it
resolves against, matching where `cvTemplates` itself already lives):

```ts
import type { DbCvTemplate } from "@/mocks/types"

/**
 * Resolves a template id against the built-in registry first, then a user's
 * saved `cv_templates` rows — the combined lookup every call site should use
 * instead of `cvTemplates.find` directly, now that ids can come from either
 * source. See docs/specs/13-save-as-new-template.md.
 */
export function findTemplate(
  id: string,
  savedTemplates: DbCvTemplate[]
): CvTemplate | undefined {
  const builtIn = cvTemplates.find((candidate) => candidate.id === id)
  if (builtIn) return builtIn

  const saved = savedTemplates.find((candidate) => candidate.id === id)
  if (!saved) return undefined

  return {
    id: saved.id,
    name: saved.name,
    description: saved.description,
    definition: saved.definition,
    density: saved.definition.density,
    atsSafe: saved.definition.atsSafe,
    bestFor: saved.definition.bestFor,
  }
}

/** Built-ins first, then a user's saved templates — the combined option list. */
export function allTemplates(savedTemplates: DbCvTemplate[]): CvTemplate[] {
  return [
    ...cvTemplates,
    ...savedTemplates.map((saved) => findTemplate(saved.id, savedTemplates)!),
  ]
}
```

Update each of the four in-scope call sites (the two Persona-page sites,
`personas.tsx`/`persona-detail.tsx`, are explicitly **out of scope** — see
"Current-state summary" above, they use `cvTemplates` for an unrelated ad hoc
preview picker this plan does not touch):

1. **`src/lib/cv.ts`, `resolveCv` (lines 61-63)**: replace
   ```ts
   const template =
     cvTemplates.find((candidate) => candidate.id === cv.templateId) ??
     cvTemplates[0]
   ```
   with
   ```ts
   const template =
     findTemplate(cv.templateId ?? "", inventory === undefined ? [] : store.cvTemplates) ??
     cvTemplates[0]
   ```
   — actually `resolveCv`'s signature is `(persona: PersonaData, inventory:
   InventoryStore, cvId: string)`, and `PersonaData` does **not** carry
   `cvTemplates` (only `PersonaStore` does, per Phase 2 — `PersonaData` is the
   plain-data subset). Since every real call site passes a full `PersonaStore`
   (which satisfies `PersonaData` structurally) — confirm this via a grep for
   `resolveCv(` call sites before writing the signature change — either (a)
   widen `resolveCv`'s first parameter type to `PersonaStore` (simplest, and
   accurate to how it's actually always called), or (b) add a third parameter
   `savedTemplates: DbCvTemplate[]`. **Prefer (a)**: check all call sites first
   (`cv-list-panel.tsx`, `cv-print.tsx` at minimum) — if every one already has a
   `PersonaStore` in scope (they do, via `usePersonaStore()`), widening the
   type is a pure type-level change, no call site's actual argument needs to
   change, only the type annotation. Then `resolveCv` becomes: `const template
   = findTemplate(cv.templateId ?? "", persona.cvTemplates) ?? cvTemplates[0]`.
2. **`src/components/cv/templates/index.tsx`, `TemplateRender` (line 41)**:
   this component currently takes no store/context — it's a pure render
   function. Add a new prop `savedTemplates?: DbCvTemplate[]` (default `[]` via
   `savedTemplates = []` destructure default), replace line 41 with:
   ```ts
   const resolvedDefinition =
     definition ??
     (findTemplate(templateId, savedTemplates) ?? cvTemplates[0]).definition
   ```
   Then find `TemplateRender`'s callers (grep `<TemplateRender`) and pass
   `savedTemplates={personaStore.cvTemplates}` at each (they're already inside
   components that call `usePersonaStore()`, or can — verify per call site;
   this is the render-time path so getting it right matters most).
3. **`src/components/cv/cv-list-panel.tsx`**: line 85's `template:
   cvTemplates.find(...)` → `template: findTemplate(cv.templateId ?? "",
   store.cvTemplates)`. Line 104's `templateOptions` → `allTemplates(store.
   cvTemplates).map((template) => ({ value: template.id, label: template.name
   }))`. Add `findTemplate`/`allTemplates` to the existing `import { cvTemplates
   } from "@/lib/cv-templates"` line (or a second named import from the same
   module).
4. **`src/components/cv/templates-panel.tsx`**: this is the gallery — per
   spec 13's Open point 2, saved templates should be *selectable* everywhere a
   built-in is, but exact gallery placement is left to this plan. **Decision
   for this plan**: keep the gallery (`templates-panel.tsx`) showing only
   `cvTemplates` (the four built-ins) unchanged — it's explicitly an "ad hoc,
   unsaved preview" surface per its own doc comment, browsing layouts before
   committing, and a saved template is already a committed choice a user makes
   directly from the CV edit page's Style/Page/Block tabs, not something they
   need to browse first. Only the **picker** (`cv-list-panel.tsx`'s `Select`,
   item 3 above) needs saved templates in its option list — that's the actual
   "pick this for another CV" flow the spec's motivating use case describes.
   Do not add saved templates to `templates-panel.tsx` in this plan.

After this phase, run `npm run typecheck` — any remaining bare `cvTemplates.find`
call outside the two explicitly-excluded Persona-page sites and `cv-templates.ts`
itself (which legitimately still owns the built-in-only array) is a signal
something in this list was missed.

## Phase 6 — Verification

1. `npm run typecheck && npm run lint` clean.
2. `npm run build` clean.
3. Unit-test-by-hand `bakeTemplateSettings` before trusting it in the browser: in
   a scratch file (delete after, or keep as a real test if this repo has a test
   runner configured — check `package.json` for `vitest`/`jest` first; if none
   exists, don't introduce one just for this, verify via a throwaway `tsx`
   script instead), import `classicTemplateDefinition`
   (`src/lib/cv-template-defs/classic.ts`) and a hand-built `TemplateSettings`
   exercising all three override kinds (a style property override, a page
   margin override, and — critically — a `nodes` override with `hidden: true`
   on a node that sits inside a `children` array vs. one that's a `block`
   instance's target), call `bakeTemplateSettings`, and diff the result against
   what `template-node-renderer.tsx` would render for the same `(definition,
   settings)` pair passed live. They must match structurally (same visible
   nodes) — this is the check called out in Phase 2 as the part most likely to
   have a subtle bug.
4. Browser check (per `CLAUDE.md`'s default: one desktop screenshot per changed
   page + a console-error check):
   - Open a CV in the edit page, make a Style edit (e.g. change a font size) —
     confirm the "Save as new template" button appears (it shouldn't before any
     edit).
   - Click it, fill Name ("Test Saved Layout") + Description, save — confirm
     the dialog closes with no console error.
   - Go to CV List → New CV (or Edit an existing CV) → open the Template
     `Select` — confirm "Test Saved Layout" appears in the list alongside
     Classic/Two Column/Batch 1 Demo.
   - Create/select a CV with that saved template, open its print/preview page —
     confirm it renders with the baked-in override visibly applied (the font
     size change from the first step), with no `settings` needed (the saved
     definition should render identically to how the original CV looked with
     its `template_settings` applied).
   - Confirm the *original* CV (the one edited in step 1) is untouched — still
     on its original template id, still showing its own `template_settings` in
     the Style tab as `overridden` (not cleared by the save).
   - Zero console errors throughout.

## Phase 7 — Docs

1. Update [specs/13-save-as-new-template.md](../specs/13-save-as-new-template.md):
   resolve open point 2 (gallery placement) in place — record the Phase 5
   decision (saved templates in the picker only, not the gallery) so the spec
   stops posing it as an open question. Resolve open point 3 (the
   `nodes.hidden` baking rule) similarly, summarizing whatever the Phase 6
   verification actually confirmed.
2. Add a new row to `docs/progress.md` for this initiative, linking this plan
   and the amended spec, following the existing table's level of detail —
   summarize what was built (new table, bake function, save dialog, five call
   sites updated minus the two deliberately excluded), what was deliberately
   trimmed (no rename/delete/re-edit of saved templates, gallery unchanged),
   and whether it was browser-verified.
