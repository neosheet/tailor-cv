# 08 — Persona Print Settings

Adds a settings panel to the CV detail page (`/cvs/:cvId/print`) for controlling what
prints and how it looks, scoped to one saved CV (a Persona + Template pairing, per
[06 — Persona / CV Split](06-persona-cv-split.md)).

**Written after the fact.** This session built directly against live direction rather
than spec → plan → `/do` — the usual write-up-first workflow was explicitly skipped in
favor of iterating with the user turn by turn. This doc exists so the decisions made
along the way have a permanent record, same as every other initiative in
`docs/progress.md`.

**Superseded in part by Batch 3** (`docs/user-request.md`, `docs/progress.md` row 19+):
field visibility moved off `personas` onto `cvs.persona_settings`, and `nodes` (below,
listed as "explicitly not resolved") is now wired. This doc is updated in place rather
than forked, since the *shape* of the feature (which tabs, what each controls) is
unchanged — only where the data lives.

## The problem this solves

Before this, a Persona's content was all-or-nothing per kind (`persona_items`) and
per-bullet selection defaulted to "everything, always" with no way to curate it
(`persona_lines` existed in the schema but nothing ever wrote to it after initial
insert). Template styling and page geometry (`TemplateDefinition.page`/`.styles`) were
shared code — the only way to change a font size or a margin was to edit the template
definition itself, affecting every Persona and every CV that uses it.

There was no way to:
- Hide a field across every entry of a kind without hand-editing each one (e.g. never
  show company names).
- Hide one specific entry, or one specific bullet, without deselecting it and losing
  the rest of its curation.
- Reorder the Sections a Persona prints.
- Nudge one CV's font size, color, padding, margin, or paper size without touching the
  Template's shared definition, which would affect every other Persona/CV using it.

## Data model

Two `jsonb` columns on `cvs`, both defaulting to `'{}'` so an unconfigured row renders
exactly as it did before this landed. **Both now live on `cvs`, not `personas`** — as of
Batch 3, field visibility moved off the Persona (see "Superseded in part by Batch 3"
above): visibility is a per-CV presentation choice, not Persona content, so two CVs
built from the same Persona can now show different things. `personas.field_visibility`
no longer exists (migration `20260810090000_move_field_visibility_to_cvs.sql`
backfilled each CV's `persona_settings` from its Persona's old value, then dropped the
column).

### `cvs.persona_settings`

```ts
type CvPersonaSettings = {
  fieldVisibility?: FieldVisibility
}

type FieldVisibility = Partial<Record<ItemKind, {
  hidden?: boolean            // hide the whole kind (Section or Basics field)
  fields?: string[]           // hide these fields, kind-wide (e.g. Work's "url")
  items?: Record<string, boolean>  // hide these already-selected entries, by item id
}>>
```

Sparse, per kind. `hidden`/`fields` are structural (apply to every entry of that kind);
`items` is a **non-destructive** per-entry hide, deliberately separate from
`persona_items` membership — removing an entry from `persona_items` cascades and
deletes its `persona_lines`, so re-adding it later resets bullet selection back to
"everything." Toggling `items[id]` back off restores exactly what was there.

`buildResumeDocument` (`lib/persona.ts`) takes the resolved `FieldVisibility` as an
optional 4th parameter instead of reading it off the Persona — `lib/cv.ts`'s
`resolveCv` passes `cv.personaSettings.fieldVisibility`; every other caller (the
Persona's own read-only page, the Templates gallery preview — neither has a CV in
scope) omits it and gets the full, untailored Persona.

Per-bullet curation (Work's responsibilities, Education's courses, ...) doesn't get a
parallel flag — it reuses `persona_lines` directly (insert/delete a row), and stays on
the Persona (unaffected by the Batch 3 move — it's genuine content selection, not a
visibility override). That table already means "which lines this Persona takes from
this entry" and is already non-destructive (the bullet's content lives in
`inventory_lines`, untouched either way), so a second bookkeeping layer would only add
a redundant "and is it also hidden" check with no benefit. Section order
(`persona_sections.position`) likewise stays on the Persona — shared across every CV
built from it, not part of `field_visibility`'s jsonb.

### `cvs.template_settings`

```ts
type TemplateSettings = {
  styles?: Record<string, Style>       // per-named-style property overrides
  page?: Partial<PageConfig>           // page config overrides
  nodes?: Record<string, { hidden?: boolean; styles?: string | string[]; text?: string }>
}
```

Lives on `cvs`, not `personas` — style/page overrides are a property of the **(Persona,
Template) pairing**, since the same Persona printed under a different Template has a
different style registry entirely. `TemplateSettings` itself predates this session
(`cv-template-schema.ts`) but was defined and never wired to anything; this session
wired up `styles`/`page`. Batch 3 wired up `nodes` too (previously defined, unused —
see "Explicitly not resolved here", now resolved) and extended it beyond `hidden` to
`styles`/`text`, addressed by a node's own `id` (authored into the template) rather
than a block name — see spec 07's "Scope and placeholders" and the Block tab below.

Every override is **shallow-merged onto the template's own values at render time**
(`cv-template-core.ts`'s `resolveStyleObject` for styles; small merges in
`TemplateNodeRenderer` for `page` and for `nodes`) — the template definition itself is
never mutated, so the override is scoped to one CV at a time.

## Rendering pipeline

`settings` (a `TemplateSettings`) now threads through `ResumeRender → TemplateRender →
TemplateNodeRenderer`, previously an unused, always-`undefined` parameter at every
level. `cv-print.tsx` passes `cv.templateSettings`. The native-print `@page` margin CSS
(`react-to-print`'s `pageStyle`) also reads the effective margin
(`cv.templateSettings.page?.margin ?? template.definition.page.margin`), so a Page-tab
margin change affects the actual printed output, not just the on-screen preview.

`orientation` was defined on `PageConfig` before this session but never read by the
renderer — it's now honored (`landscape` swaps the page's width/height in
`TemplateNodeRenderer`), since otherwise the new Page tab's orientation control would
be inert.

`entry.url` (Work/Education/etc.'s website field) was similarly defined on
`ResumeEntry` but never rendered by the Classic template — added a conditional line to
`entryBlock` (at the time, in the shared `cv-template-blocks.ts`; Batch 3 later inlined
`entryBlock` into each template def file — see spec 07) so hiding it from the
Visibility tab has a visible effect.

## UI

`components/cv/persona-field-tree.tsx` — a Card with five line-style tabs, replacing
the CV detail page's previously-empty sidebar slot:

| Tab | Controls |
|---|---|
| **Visibility** | Folder tree mirroring the Inventory nav (Basics kinds, then every Section kind). Eye toggle per kind (structural hide) and per field (`FIELD_REGISTRY` in `lib/persona.ts`, restricted to fields the Classic template actually renders). Up/down reorder on Section kinds, writing `persona_sections.position`. Per-CV as of Batch 3 (`cv.personaSettings.fieldVisibility`). |
| **Data** | Per already-selected entry (Social links, and every Section kind's entries): eye toggle for the entry itself (`fieldVisibility.items`), expanding into its bullets (responsibilities/highlights/courses/keywords/roles) with their own eye toggle (`persona_lines` membership, still Persona-level). |
| **Style** | Picks one of the current Template's named styles — labeled via `stylesSchema` (Batch 3) instead of the raw internal key, with a description underneath — shows its effective (base + override) properties grouped (Text/Color/Spacing/Size/Border/Layout/Other), each with a reset-to-template button. Can add a property the base style doesn't define. Manifest-driven off `lib/style-property-schema.ts` — explicitly modeled on `json-ui`'s `StyleEditor.jsx` + `propertySchema.json` (`~/Desktop/json-ui`), adapted for this app's point-based (not px/em/%) length values. |
| **Page** | Same manifest-driven approach as Style, over the fixed field set in `lib/page-property-schema.ts` (paper size, orientation, margin, header/footer space, base font family/size/line-height, text color). Unlike Style, this is a closed set — every field always shows, no "add property" picker. |
| **Block** (Batch 3) | Picks one addressable node instance in the template tree — grouped by which block it belongs to, labeled via `blocksSchema` — and overrides its style reference and/or literal text, for this CV only. See spec 07's `RepeatNode.repeat.merge`/node-`id` sections and `lib/cv-template-core.ts`'s `collectBlockNodeIds`. |

`lib/cv.ts` gained the mutators: `setCvStyleProperty`/`resetCvStyleProperty`,
`setCvPageProperty`/`resetCvPageProperty`, and, as of Batch 3,
`setKindHidden`/`setFieldHidden`/`setItemHidden` (moved from `lib/persona.ts`, now
cvId-keyed) and `setCvNodeOverride`/`resetCvNodeOverride`. `lib/persona.ts` keeps
`setLineSelected`/`reorderPersonaSections` (genuine Persona content, unaffected by the
move) plus selectors `orderedSectionKinds`/`selectedEntriesOf`/`selectedLineIdsOf`/
`isKindHidden`/`hiddenFieldsOf`/`isItemHidden` (the last three now pure — they take a
`FieldVisibility` value as an argument rather than reading it off a Persona row).

Separately, the CV detail page now collapses the app's global sidebar to icon-only for
its own duration (`useSidebar()`'s `setOpen(false)` on mount, restored on unmount) —
the settings panel and print preview need the width back.

## Decisions made along the way

- **Item-level hide is non-destructive** (a new flag) rather than reusing
  `persona_items` selection, specifically because removing/re-adding an item cascades
  its `persona_lines` and loses bullet curation. Line-level hide, by contrast, *does*
  reuse the existing selection mechanism (`persona_lines`) rather than adding a second
  flag, because toggling that table's membership was already fully reversible with no
  data loss — a second flag there would just be redundant bookkeeping.
- **Contact stays exclusively in the Visibility tab.** It's a single picked item with
  no bullets and no other selected entries to curate, so it has nothing that belongs in
  the Data tab — its Email/Phone/Website field toggles (Visibility) are the complete
  answer.
- **Style/Page overrides live on `cvs`, not `personas`**, since they're specific to a
  (Persona, Template) pairing, not the Persona's content.

## Explicitly not resolved here

- ~~**`TemplateSettings.nodes`** (per-node `hidden` override) predates this session,
  stays defined, stays unwired.~~ **Resolved in Batch 3** — see the Block tab above and
  spec 07.
- **`header`/`footer`** on `PageConfig` hold structured `TemplateNode` content, not a
  scalar — the Page tab excludes them entirely. No editor for page headers/footers
  exists yet.
- ~~**`template-pdf-renderer.tsx`** (the `@react-pdf/renderer` backend) does not read
  `templateSettings`...~~ **Moot** — the PDF backend was deleted outright on the
  `native-print` branch (see spec 07's amendment note); `TemplateNodeRenderer`, via
  native `window.print()`, is the only renderer left and it does read `templateSettings`.
- **Not verified in a browser.** `npm run typecheck` and `npm run lint` are clean at
  every step; the user explicitly opted to check the UI themselves rather than have it
  driven via Chrome DevTools this session.
