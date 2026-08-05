# CV selection layer, then real CV templates

## Context

The ask is "create templates — templates is for CV layout". A template lays out a CV, but
**there is no CV to lay out**: `cvs` / `cv_sections` / `cv_items` / `cv_lines` are sketched
in `docs/specs/02-inventory-data-model.md:665–710` under "How CV selection will use this"
and explicitly marked *not part of this spec*. Nothing implements them.

So templates are built second. First the selection layer gets a spec and mock data, which
gives templates something realistic to render — four jobs out of ten, only the bullets
tagged for the role — instead of the whole 68-item Inventory spilling over six pages.

Two gallery changes requested alongside this: drop **Use this template**, add **View**
opening a full-size popup. Those need no data, so they land first.

Ends with: `/templates` previewing four real, print-accurate layouts driven by a real CV.

## Approach

Templates are **pure presentation**. A template is `(document: ResumeDocument) => JSX` and
never touches `DbInventoryItem`, `linesOf()`, or any mock selector. Everything data-shaped
happens in one builder, so swapping mock selections for Supabase later changes one file and
no templates.

### Phase 1 — Templates gallery (no data needed)

`src/components/cv/template-card.tsx`
- Remove the **Use this template** button and the "Preview is a layout mockup" caption.
- Add **View** — opens `TemplateViewDialog`, a new near-fullscreen dialog
  (`sm:max-w-5xl max-h-[92vh]`) showing the layout at full page size.

`src/components/cv/template-view-dialog.tsx` (new) renders `TemplatePreview` large. Phase 5
swaps its body for the real render; the dialog shell stays.

### Phase 2 — `docs/specs/03-cv-selection.md` (new)

Promotes the sketch in spec 02 to a real spec. Four tables, all carrying `note`,
`deleted_at`, and timestamps to match the conventions already set:

| Table | Holds |
|---|---|
| `cvs` | one row per tailored document — `name`, `template_id`, `user_id` |
| `cv_sections` | which pools appear and in what order, per CV |
| `cv_items` | which entries are selected, `position` scoped to its section |
| `cv_lines` | which bullets within each entry — FK `(cv_id, item_id)` → `cv_items` so deselecting an entry drops its bullets |

Also settles the question left open in `docs/progress.md` row 04: **template binding lives
on the CV** (`cvs.template_id`), not global and not chosen at print time — a tailored
document owns its own look.

Updates spec 02 to point at spec 03 instead of describing the tables inline, and closes
spec 01's open question about Trash if it touches CVs.

### Phase 3 — Mock CVs + the document builder

`src/mocks/data/cvs.ts` (new) — two CVs over the existing Arya dataset, hand-curated so the
output is a believable one-to-two page CV:
- **"Senior Backend — Nusantara"**: `name-full`, `headline-backend`, `summary-backend`,
  4 of 10 jobs, only `backend`/`platform`-tagged bullets, 6 skills, 1 education, 2 projects.
- **"Engineering Lead — Globex"**: `headline-platform`, `summary-leadership`, the same jobs
  but `leadership`-tagged bullets, different section order (Skills below Work).

The second exists to prove the premise: same Inventory, visibly different CV.

`src/mocks/cv.ts` (new) — selectors mirroring the eventual queries, plus the one function
templates consume:

```ts
export type ResumeDocument = {
  name: string; headline: string | null; summary: string | null
  contact: { email; phone; url } | null
  location: string | null
  socials: { network; username; url }[]
  sections: ResumeSection[]   // ordered, already filtered to selected rows
}
export function buildResumeDocument(cvId: string): ResumeDocument
```

`buildResumeDocument` is the seam. It reads `cv_*` + `inventory_*` from the mocks today and
Supabase later; nothing downstream changes.

### Phase 4 — Template components

`src/components/cv/templates/` — one file per layout, each `(document) => JSX`, matching the
four already described in `src/lib/cv-templates.ts`: `classic`, `sidebar`, `compact`,
`academic`. Shared bits (`SectionHeading`, `EntryHeader`, `BulletList`) in
`templates/primitives.tsx`.

`cvTemplates` gains `component: (props: { document: ResumeDocument }) => ReactNode`, so the
gallery and the print route both resolve a template by id with no switch statement.

**Print CSS** in the global stylesheet (`src/index.css`, the one file the conventions allow
editing): `@page { size: A4; margin: 0 }`, `print-color-adjust: exact`, and
`break-inside: avoid` on entries so a job never splits across a page boundary. On screen a
page is a fixed-width sheet with shadow; in print it is the page itself.

### Phase 5 — Wiring

- `TemplateViewDialog` renders the real template against the first mock CV.
- `TemplatePreview` (the abstract skeleton) is deleted — the card thumbnails become the real
  template scaled down with `transform: scale()`, so the gallery stops being a mockup.
- `/cvs` lists the mock CVs in a table, reusing `PoolPanel`/`PoolTable`.
- `/cvs/:id/print` renders one CV full-page for `Ctrl+P`.

Per `CLAUDE.md`, persist this plan to `docs/plans/03-cv-selection-and-templates.md` and add
rows to `docs/progress.md` as phases land.

## Reused, not rebuilt

- `src/mocks/index.ts` — `itemsOfKind`, `linesOf`, `contactDetails`, `locationDetails`,
  `formatLocation` already do the reads `buildResumeDocument` needs.
- `formatPartialDate` in `src/components/inventory/columns.tsx` — date rendering is solved;
  templates import it rather than reimplementing.
- `PoolPanel` / `PoolTable` for `/cvs`.
- `src/lib/cv-templates.ts` — keep the metadata, add `component`.

## Verification

1. `npm run typecheck`, `npm run lint`, `npm run build` clean after each phase.
2. Phase 1: `/templates` — **Use this template** gone, **View** opens the dialog.
3. Phase 3: assert in a scratch script that `buildResumeDocument("cv-backend")` yields 4
   work entries and that every bullet it returns is tagged `backend` or `platform`.
4. Phase 5: `/templates` thumbnails are real renders; switching CV between the two mock CVs
   visibly changes headline, summary, bullets, and section order under the same template.
5. Print check on `/cvs/:id/print`: A4 page count is 1–2, and no entry splits across pages.
6. Console clean throughout.

## Out of scope

The CV **builder** UI — creating a CV and picking entries by hand. This plan gives the data
model and mock selections, so templates and the CVs list work; authoring comes after.
Applications, snapshots, and statuses are untouched.
