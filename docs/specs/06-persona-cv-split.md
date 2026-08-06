# 06 — Persona / CV Split

Splits today's single `cvs` entity into two: **Persona** (a named selection of content,
no layout) and **CV** (a Persona paired with a Template, saved and reusable). Depends on
[01 — App Taxonomy](01-app-taxonomy.md) and [03 — CV Selection](03-cv-selection.md), and
partially supersedes both — see [What this supersedes](#what-this-supersedes).

## The problem this solves

Spec 03 made the template a free, unpersisted preview choice: pick any CV, pick any
template, see the result, nothing saved. That already means you never need to duplicate
a CV's content just to see it under a different layout.

What it doesn't give you is a **stable, named, reusable pairing**. There's no way to
settle on "this content, in this layout" once and refer back to it — the template choice
resets every time the page loads, and nothing you build today can be handed to something
else (an Application, a shared link, an export) as a fixed reference. That's the actual
gap, and it's what this spec adds — not a fix for content duplication, which was never
required.

## Terminology

| Section/entity | Before | After | Meaning |
|---|---|---|---|
| Raw material section | Profile | Profile (unchanged) | Every item pool — Basics, Work, Education, etc. Never sent to anyone. |
| Content selection | `cvs` (called "CV") | **Persona** | A named, reusable selection of entries and bullets drawn from Profile. No layout. You can have several: "Backend Persona," "Leadership Persona." |
| Layout | Template (unchanged) | Template (unchanged) | A print layout. Presentation only, per spec 01. |
| Finished document | *(didn't exist as a saved thing)* | **CV** | A Persona paired with a Template, named and saved. The thing you preview, print, and eventually attach to an Application. |

"CV" keeps its place as spec 01 intended — "the only word used for a finished
document" — it just now names a real saved row instead of an ephemeral (CV, template)
pairing chosen at print time.

## Model

```
Profile (pools)            Persona (selection)          CV (composed)
  skills     ─┐                                          
  work        ─┼──────→   "Backend Persona"   ──┐
  education   ─┤          "Leadership Persona" ──┼──→   "Backend — Modern"      (Persona A, Template 1)
  languages   ─┘                                  │      "Backend — Sidebar"     (Persona A, Template 2)
                                                   └──→   "Leadership — Modern"  (Persona B, Template 1)
```

One Persona can back many CVs. A CV always has exactly one Persona and exactly one
Template.

## Tables

Renames three existing tables and adds one new one. No column shapes change on the
renamed tables — only names, to free up `cvs` for its new meaning.

### `personas` (renamed from `cvs`)

Same shape as today's `cvs`: `id`, `user_id`, `name`, `note`, `created_at`,
`updated_at`. No `deleted_at` — soft delete isn't implemented anywhere in this schema
yet (spec 02, progress row 08), so this table doesn't get it either, same as `cvs`
doesn't today.

### `persona_sections` (renamed from `cv_sections`)

Unchanged shape: `persona_id`, `kind` (`item_kind`), `position`. PK
`(persona_id, kind)`.

### `persona_items` (renamed from `cv_items`)

Unchanged shape: `persona_id`, `item_id`, `position`. PK `(persona_id, item_id)`.

### `persona_lines` (renamed from `cv_lines`)

Unchanged shape: `persona_id`, `item_id`, `line_id`, `position`. PK `(persona_id,
line_id)`, FK `(persona_id, item_id) → persona_items`. The guard trigger renames with
it — `cv_line_belongs_to_item()` becomes `persona_line_belongs_to_item()`, same logic.

### `cvs` (new meaning)

One row per saved (Persona, Template) pairing.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | what a future Application would point at |
| `user_id` | `uuid` FK → `profiles(id)` | `ON DELETE CASCADE` |
| `persona_id` | `uuid` FK → `personas(id)` | `ON DELETE CASCADE` — content source |
| `template_id` | `text` | **not a real FK yet** — matches the static ids in `src/lib/cv-templates.ts`. Becomes a proper FK once the `cv_templates` table lands (spec 05 / plan 06, currently "Planned — not started") |
| `name` | `text` | "Backend — Modern layout." Yours, never rendered on the CV |
| `note` | `text` | private annotation, as everywhere else |
| `created_at` / `updated_at` | `timestamptz` | |

No uniqueness constraint on `(persona_id, template_id)` — nothing stops two
independently-named CVs from pairing the same Persona and Template; no reason to block
that.

**Ad hoc preview stays free.** Nothing here removes the "pick any Persona, pick any
template, look at it, nothing saved" flow from the Templates gallery — that's still
useful for browsing before committing to a saved CV. This spec adds a persisted layer
alongside it; it doesn't require every preview to be saved.

## Row-level security

Same shape as spec 03, renamed:

```sql
create policy "own rows" on personas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sections" on persona_sections
  for all using (
    exists (select 1 from personas p where p.id = persona_sections.persona_id
              and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from personas p where p.id = persona_sections.persona_id
              and p.user_id = auth.uid())
  );
```

`persona_items` and `persona_lines` take the same shape against `personas`. `cvs` takes
the same direct-`user_id` policy shape it does today.

## Indexes

| Index | Reason |
|---|---|
| `personas (user_id)` | the Personas list |
| `persona_sections (persona_id, position)` | assembling a Persona |
| `persona_items (persona_id, position)` | the entries of a Persona |
| `persona_items (item_id)` | reverse lookup — which Personas use this entry |
| `persona_lines (persona_id, item_id, position)` | the bullets of one entry |
| `persona_lines (line_id)` | reverse lookup for the delete warning |
| `cvs (user_id)` | the CVs list |
| `cvs (persona_id)` | reverse lookup — which CVs a Persona backs, for its own delete warning |

## Navigation

The CVs section gains a second page. Both live under the existing **CVs** top-level
section (unchanged position in the sidebar) as peer pages, the same pattern the Profile
section already uses for multiple pages:

| Page | Purpose |
|---|---|
| **Personas** | List and build Personas — pick entries and bullets from Profile, same interaction the current CV builder already has. |
| **CVs** | List of saved (Persona, Template) pairings. Creating one picks an existing Persona and a Template and names the result. Opening one previews/prints it — same as today's `/cvs/:id/print`. |

Route slugs and exact page layout are implementation detail for the plan, not fixed
here.

## What this supersedes

- **Spec 03, "Template binding."** That section's rule — "neither choice is
  persisted, and switching either one is free" — no longer holds universally. A CV
  (this spec's new meaning) is exactly a persisted (Persona, Template) pairing. Ad hoc,
  unsaved preview of any Persona under any template remains available (see Tables,
  above) — this spec adds a persisted option, it doesn't remove the free one.
- **Progress row 10** ("Template is preview-only") is superseded by this spec for the
  same reason.

## Explicitly not resolved here

- **Applications binding.** Spec 03 left "which layout did this employer get" as a
  per-application question, unspecced. This spec deliberately leaves it that way —
  whether a future Application points at a `cvs` row directly, freezes its own
  independent snapshot, or something else, is a decision for when Applications gets
  specced, not assumed here.
- **Inventory/Profile naming drift.** The code still says "Inventory" throughout
  (routes, component directory, table names) despite the UI already reading "Profile."
  Real, but unrelated to this split — separate cleanup, out of scope.

## Open points

1. **Ordering stays a Persona property.** `position` on `persona_sections` /
   `persona_items` / `persona_lines` is not overridable per CV in this version — two
   CVs built from the same Persona render sections/entries/bullets in the same order
   even under different templates. Revisit if a template's layout genuinely needs
   different ordering (e.g., a two-column design). Deferred rather than designed
   speculatively.
2. **`cvs.template_id` is a loose reference**, not a real foreign key, until the
   `cv_templates` table exists (spec 05 / plan 06). Tighten it then.
3. **Migration timing is favorable now.** Per progress row 13, the CV tables aren't
   cut over to live Supabase usage yet — the app still reads mock data for CVs. Renaming
   `cvs` → `personas` (and its children) costs nothing in real user data today. Do this
   before the CV template JSON work (row 14) and before any CVs Supabase cutover
   proceeds, since both would otherwise need to redo the same ground.
