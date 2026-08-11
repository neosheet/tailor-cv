# 09 — CV export/import, and the reusable snapshot format

## Why

Two independent asks turn out to be the same underlying problem:

1. **Export/import a CV** as a self-contained JSON file — no dependency on this
   database or this codebase's template registry to hold the data.
2. **Applications** (spec 10) needs to freeze an honest copy of "the CV as it was
   when sent" — independent of later edits to the Persona or the CV's own settings.

Both need the same thing: a CV *rendered down to data* — content already resolved,
template already inlined, nothing left to look up. This spec designs that shape once
(the **CV snapshot**) and uses it for both.

Spec 01 flagged this exact gap and deliberately left it open ("Snapshots are still
undesigned... settle it when Applications is specced" — spec 03's open points; spec
01's open questions #1–2). This spec, plus spec 10, settle it.

## What "self-contained" means

A CV today (`cvs` row) is a *pointer*: `persona_id` + `template_id` + override jsonb.
Rendering it means joining across `personas`/`persona_sections`/`persona_items`/
`persona_lines`/`inventory_items`/`inventory_lines` and looking `template_id` up in
the code-level `cv-templates.ts` registry. None of that travels outside this app.

A **snapshot** replaces the pointer with the resolved result:

- The fully-resolved `ResumeDocument` (same shape `buildResumeDocument` already
  produces — sections, entries, bullets — already filtered through the CV's own
  field-visibility settings). No `persona_id`, no `inventory_items` reference.
- The complete `TemplateDefinition` **inlined** (styles, blocks, page, stylesSchema,
  blocksSchema, root) — not a `template_id` to look up in `cv-templates.ts`.
- The CV's `templateSettings` (style/page/node overrides), since those are already
  data, not code.
- A little metadata: name, note, tags, the format version, an export timestamp.

Everything a template-node-renderer needs to draw the CV is present in the file.
Nothing about the exporting account, database, or template registry is required to
render it again.

## The type

New file `src/lib/cv-snapshot.ts`:

```ts
export type CvSnapshotV1 = {
  formatVersion: 1
  exportedAt: string // ISO timestamp
  name: string
  note: string | null
  tags: string[]
  document: ResumeDocument
  template: TemplateDefinition // inlined, not a lookup key
  templateSettings: TemplateSettings
}
```

`formatVersion` is there from day one even though there's only one version — the
importer rejects anything it doesn't recognize rather than guessing. A future format
change bumps this and the importer either migrates or errors clearly, instead of
silently mis-rendering.

Validated on import with a `zod` schema mirroring `cv-template-schema.ts`'s existing
pattern (`parseTemplateDefinition`) — reuse that function for the `template` field
rather than re-deriving it.

## Export

Adds an **Export** row action to the CV list (`cv-list-panel.tsx`) and to the CV
detail page (`cv-print.tsx`). Both call the same builder:

```ts
buildCvSnapshot(cv: DbCv, document: ResumeDocument, template: CvTemplate): CvSnapshotV1
```

— the same three values `resolveCv` already produces, so both call sites already
have what they need. Downloads `<cv-name-slugified>.json` via a plain
`Blob`/`URL.createObjectURL` — no new dependency.

Exporting a CV that is *itself* an imported snapshot (below) just re-serializes its
own stored snapshot — trivially self-contained already.

## Import

Adds an **Import** button to the CV list. File picker → parse JSON → validate against
`CvSnapshotV1` (reject on schema mismatch or unrecognized `formatVersion`, toast the
error) → insert a new `cvs` row and add it to the list. No merge, no dedup — always a
new row, same "extra copy, never silently overwrite" rule already used elsewhere in
the app (e.g. Duplicate).

**The imported CV is frozen: content-read-only, presentation-editable.** Decided
explicitly (see Decisions) over reconstructing a full editable Persona:

- `persona_id` is `null` — there is no Persona backing it, so there is nothing to
  select/deselect entries from.
- `snapshot` (new column, below) holds the full `CvSnapshotV1` blob.
- `template_id` is kept as an informational copy of the original template's id from
  the file (useful for display — "Template: Classic" — never re-resolved through
  the registry) but may not match a template this account actually has installed;
  that's fine, it's never looked up.
- `template_settings` is seeded from the snapshot's `templateSettings` and stays
  live-editable going forward — Style/Page/Block-instance tabs keep working on an
  imported CV exactly as they do on a live one, because those tabs only ever read
  `cv.templateSettings` and the template's own definition, never the Persona.
- Visibility/Data tabs (which mutate Persona-side selection/field-visibility) are
  hidden for a snapshot CV — there's no Persona for them to act on.

## Rendering a snapshot CV

`resolveCv` (`src/lib/cv.ts`) gains one branch at the top:

```ts
if (cv.snapshot) {
  return {
    cv,
    document: cv.snapshot.document,
    template: templateFromSnapshot(cv.snapshot), // TemplateDefinition -> CvTemplate shape
  }
}
// ...existing persona_id/template_id lookup path unchanged
```

`templateFromSnapshot` wraps the inlined `TemplateDefinition` in whatever thin
`CvTemplate` shape (`cv-templates.ts`) the renderer expects (id/name + the
definition) — no registry lookup, no code dependency.

Everything downstream (`cv-print.tsx`, `TemplateNodeRenderer`, the Style/Page/Block
mutators in `cv.ts`) already operates on `{document, template, templateSettings}` /
`cv.templateSettings`, not on `persona_id` directly, so no other rendering code
changes.

## Data model

Extends the existing `cvs` table (`supabase/migrations/`):

| Column | Change |
|---|---|
| `persona_id` | now nullable (was `not null`) |
| `template_id` | now nullable (was `not null`) — kept as informational metadata only for snapshot rows |
| `snapshot` | new, `jsonb null` |

Check constraint: a row is either **live** (`persona_id is not null`) or **frozen**
(`snapshot is not null`) — never neither, never both:

```sql
alter table cvs add constraint cvs_live_xor_frozen check (
  (persona_id is not null and snapshot is null) or
  (persona_id is null and snapshot is not null)
);
```

`database.types.ts` regenerated after the migration.

## UI touch points

- `cv-list-panel.tsx`: **Import** button next to **New CV**; **Export** added to each
  row's action menu.
- `cv-form-dialog.tsx` (edit): Persona/Template selects hidden for a snapshot CV
  (nothing to reassign — importing a fresh file, not this dialog, changes content);
  Name/Note/Tags stay editable.
- `cv-print.tsx`: works unmodified once `resolveCv` branches correctly; add **Export**
  next to the existing Download-PDF action. The sidebar (`PersonaFieldTree`) hides
  its Visibility/Data tabs when `cv.personaId` is null, matching the "presentation
  editable, content frozen" rule above.
- CV list gets a visual marker (e.g. a small "Imported" badge) so a frozen row isn't
  mistaken for one you can still re-tailor from the Persona.

## Decisions

- **Frozen import, not full editable restore.** A full restore would mean
  reconstructing Persona + every Inventory item/line/skill-link/tag/category from the
  file and remapping ids — a much larger effort duplicating most of the Inventory
  import story, for a use case ("hand someone a CV file") that doesn't need it. If a
  true backup/restore of the whole Inventory is wanted later, that's a separate,
  bigger feature (see spec 01's existing `Import / Export` Profile utility page,
  which already covers whole-`resume.json` import — out of scope here).
- **One JSON, one CV.** No bulk "export all CVs" in this pass.
- **No re-import-to-live.** An imported CV can never be "unfrozen" back into a
  Persona-backed CV. If that's wanted later it's an "unpack into a new Persona"
  feature, not part of this spec.

## Out of scope

- Bulk export/import.
- Converting a frozen CV back to an editable one.
- Any change to the existing whole-Profile `resume.json` import/export utility page.
- Versioned migration logic beyond rejecting unrecognized `formatVersion` (nothing to
  migrate yet — only version 1 exists).
