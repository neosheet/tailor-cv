# 13 — Save as New Template

Lets a CV's current Style/Page/Block edits be saved as a standalone, reusable
`TemplateDefinition` — so the same layout can be picked for another CV without
re-doing the edits. Builds the `cv_templates` table both [05 — CV Template
Format](05-cv-template-format.md) ("Storage," out of scope there) and [07 — CV
Template Format v2](07-cv-template-pdf-format.md) ("Out of scope," same table)
deferred, and resolves [06 — Persona/CV Split](06-persona-cv-split.md)'s open
point 2 ("`cvs.template_id` is a loose reference... tighten it then").

## The problem this solves

A CV's Style/Page/Block tabs (`persona-field-tree.tsx`, per spec 08) edit
`cvs.template_settings` — a per-CV *delta* on top of one of the built-in
templates in `src/lib/cv-templates.ts`. That delta is scoped to one CV only.
Getting the same look on a second CV today means reopening its Style/Page/Block
tabs and reproducing every override by hand — there's no way to lift "this
layout, as edited" back out into something reusable.

## Shape

```
Built-in template (code)  ──┐
                             ├─ base definition + template_settings ─→ bake ─→ standalone TemplateDefinition ─→ cv_templates row
CV's template_settings   ───┘
```

"Save as new template" doesn't persist the *delta* — it produces a new,
fully-resolved, standalone `TemplateDefinition` (schemaVersion 2) with the
delta already applied. This follows the format's own rule directly: spec 07's
"one definition is one file, nothing resolves against another file at render
time" means a saved template can't be `(base id, settings)` — it has to be a
complete `TemplateDefinition` on its own, exactly like every built-in.

## New table: `cv_templates`

```sql
create table cv_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  schema_version int not null,
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

Matches spec 05's deferred design (`id`, `user_id` nullable for built-ins,
`name`, `definition`, `schema_version`) with two adjustments: `user_id` is
`not null` here since built-ins stay code-shipped, not seeded rows (see "What
this doesn't change," below) — every row in this table is a user's own saved
template. `description` is added (not in spec 05's sketch) since the save
dialog collects one. `definition` is read with `parseTemplateDefinition`
(`cv-template-schema.ts`) on every load, same as any other definition —
`schema_version` lets that read refuse a row from a future, incompatible
schema instead of guessing (spec 07 open point 1, still otherwise unresolved).

## Baking `template_settings` into a standalone definition

New function, `bakeTemplateSettings(definition: TemplateDefinition, settings:
TemplateSettings): TemplateDefinition` (natural home: `cv-template-core.ts`,
alongside the existing style-resolution helpers it shares with the renderer).
Produces a definition where every override is now a literal part of the tree —
the result renders identically with no `settings` passed at all:

- **`page`** — shallow merge, `{ ...definition.page, ...settings.page }`.
- **`styles`** — for each key in `settings.styles`, shallow-merge the override
  onto `definition.styles[key]` (preserves that style's own `extends`, since
  overrides are `Style`, not `StyleDef`).
- **`nodes`** — walk `root` and every `blocks[*].node`; for a node whose own
  `id` is a key in `settings.nodes`: `hidden: true` drops the node from its
  parent's `children` (or unsets a `then`/`else`/`separator` slot) rather than
  rendering a settings-driven null at runtime; `styles` concatenates onto the
  node's own `styles`; `text` overwrites the node's own `text`. Reuses the
  same node-shape walk `collectBlockNodeIds` (`cv-template-core.ts`) already
  does to enumerate ids for the Block Settings tab.

This is the one genuinely new algorithm this spec adds — everything else is
plumbing. It only needs to handle the three `TemplateSettings` shapes above;
no new node types or settings fields.

## UI: the button and dialog

**Button** — on the CV edit page (`persona-field-tree.tsx`), visible once the
CV's `template_settings` has any override at all:

```ts
const hasOverrides =
  Object.keys(cv.templateSettings.styles ?? {}).length > 0 ||
  Object.keys(cv.templateSettings.page ?? {}).length > 0 ||
  Object.keys(cv.templateSettings.nodes ?? {}).length > 0
```

Same signal already computed ad hoc per-field as `overridden` in `PropertyRow`
(style/page rows) and per-node in the Block tab — reused here as one combined
check rather than a new tracked flag, since nothing in this codebase persists
a separate "dirty" bit (every edit writes straight through to Supabase; see
research above). Placed alongside the Style/Page/Blocks tabs, not inside any
one of them — it saves the combination of all three.

**Dialog** — pattern-matched on `cv-form-dialog.tsx`/`persona-form-dialog.tsx`:
`name` (required) and `description` (optional), the two fields
`TemplateDefinition` actually carries as user-facing metadata beyond the
layout itself. `density`, `atsSafe`, `bestFor` are **not** collected — they're
authoring judgment calls the built-ins make about themselves, not something a
"save what I just tweaked" flow should ask a user to self-assess; baked
definitions default `density: "Balanced"`, `atsSafe: false` (a customized
layout hasn't been vetted for parser-safety), `bestFor: ""`.

**On submit**: resolve the CV's current base template (the same lookup
`cv-print.tsx`/`persona-field-tree.tsx` already do), call
`bakeTemplateSettings(base.definition, cv.templateSettings)`, overwrite its
`id`/`name`/`description` with a fresh uuid and the dialog's fields, insert
one `cv_templates` row. The CV being edited is untouched — still points at its
original base template id with its `template_settings` intact, still further
editable. This is deliberately a **copy-out**, not a rebind: the point is
making the layout available to *other* CVs, not changing this one. (A "switch
this CV to the new template" follow-up is a natural next ask but not part of
this spec — see Out of scope.)

## Making saved templates selectable

A saved template needs to reach every place a built-in one does today. Five
call sites currently do `cvTemplates.find((t) => t.id === templateId)`
directly against the hardcoded array: `src/lib/cv.ts` (`resolveCvTemplate` or
equivalent), `src/components/cv/templates/index.tsx` (the actual render-time
lookup — every printed/previewed CV goes through this), `cv-list-panel.tsx`
(both the picker's option list and resolving a CV row's chosen template),
`templates-panel.tsx` (the gallery), and the template pickers in
`personas.tsx`/`persona-detail.tsx`.

All five need a combined list — built-ins plus the current user's
`cv_templates` rows — not five separate patches. Natural shape: a store-backed
lookup (`cv_templates` loaded into `PersonaStoreContext` alongside `cvs`, same
one-fetch-per-session pattern already used for `personas`/`cvs`) exposing one
`findTemplate(id): CvTemplate | undefined` that checks the hardcoded array
first, then the store's loaded rows, used everywhere in place of the direct
`cvTemplates.find`. `cvs.template_id` stays `text` (spec 06 open point 2 said
"tighten it then" — a `uuid` cast to `text` satisfies that without a schema
change, since built-in ids like `"classic"` and saved-template uuids share the
same column without collision).

## What this doesn't change

- Built-in templates stay code-shipped `TemplateDefinition` values in
  `src/lib/cv-template-defs/*.ts` — this spec adds a second, user-owned
  source alongside them, not a migration of the built-ins into the table.
- Editing a saved template after creation (rename, re-open and tweak its
  layout, delete). Out of scope below.
- Rebinding the CV being edited onto the template it just produced.

## Out of scope

- Editing, renaming, or deleting a saved template once created — this spec
  only adds the save path. A saved template is picked and used like a
  built-in; managing the list is a follow-up.
- A visual/WYSIWYG template editor — unchanged from specs 05/07's exclusion.
  This spec's "editor" is still exactly the existing Style/Page/Block tabs;
  nothing new is editable, only savable.
- Sharing a saved template with another user, or exporting/importing it as a
  file — `cv_templates` rows are private to `user_id`, same as every other
  table's RLS in this schema.
- Rebinding the source CV to its own freshly-saved template.
- Handling a `schema_version` mismatch beyond refusing to load the row (no
  migration function between versions — same open point spec 07 already
  carries, not resolved here).

## Open points

1. **Duplicate names.** No uniqueness constraint on `(user_id, name)` — two
   saved templates can share a name, same as `cvs.name`/`personas.name` allow
   duplicates elsewhere in this schema. Consistent with existing convention,
   not treated as a gap to close here.
2. **Gallery placement.** Whether saved templates render in
   `templates-panel.tsx` intermixed with the four built-ins, in a separate
   "Your templates" section, or only surface in the picker `Select`s
   (`cv-list-panel.tsx`/`personas.tsx`) without a gallery card at all, is
   implementation detail for the plan — this spec only requires that they be
   *selectable* everywhere a built-in is.
3. **Baking `nodes.hidden` when the node is a `repeat`/`if` branch root.**
   `bakeTemplateSettings` needs one concrete rule per parent-slot shape
   (`children` array vs. a single `then`/`else`/`separator` field) — worth
   enumerating against the real built-in definitions during planning rather
   than guessed here, since getting empty-propagation wrong would silently
   change how a saved template renders relative to the CV it was baked from.
