# 08 — Persona / CV Split

Implementation plan for [specs/06-persona-cv-split.md](../specs/06-persona-cv-split.md).
Also touches [specs/03-cv-selection.md](../specs/03-cv-selection.md), which this
partially supersedes (spec 03 is left as-is, historical — spec 06 is the source of
truth going forward).

**What this does, in one line:** renames today's `cvs`/`cv_sections`/`cv_items`/
`cv_lines` (content selection, no layout) to `personas`/`persona_sections`/
`persona_items`/`persona_lines`, and introduces a new `cvs` table meaning a saved
(persona, template) pairing — end to end, DB through UI.

**What this does not do:** build a content-selection builder UI. None exists today
(progress row 09: "No CV builder yet — selections are authored in mocks") and this plan
doesn't add one — Personas stays a read-only list, same limitation the old CVs page
already had. It also doesn't touch Applications binding or the Inventory/Profile code
naming drift — both explicitly out of scope per spec 06.

---

## Phase 0 — Documentation discovery (consolidated)

Full repo inventory gathered before writing this plan. Cited paths/lines below are
exact, from direct file reads.

### Database

`supabase/migrations/20260805193855_cv_schema.sql` (84 lines) is the only migration
defining `cvs`/`cv_sections`/`cv_items`/`cv_lines` — full text already quoted in spec
03 and reproduced in Phase 1 below. A later migration,
`supabase/migrations/20260805194100_fix_function_search_path.sql:3`, alters
`cv_line_belongs_to_item()`'s `search_path` — irrelevant to functionality, but confirms
the function name that needs renaming.

**The remote Supabase project has live rows in these tables already** — `scripts/seed.ts`
signed in as the real account and inserted 2 seed CVs (progress row 13: "68 items / 165
lines / 45 skill links / 47 tags / 2 CVs, exact match"). **This means the migration
must rename, not drop-and-recreate** — `alter table ... rename to ...`, not `drop
table` + `create table`. Postgres resolves RLS policies, triggers, indexes, and FKs by
OID, not by name, so renaming a table automatically keeps all of those working without
needing to be recreated — confirmed via standard Postgres rename semantics (same
mechanism that keeps views working after a table rename). Only rename statements are
needed; do not rewrite the policy bodies.

`src/lib/database.types.ts` (538 lines) is a generated Supabase types file (`supabase
gen types` output, `__InternalSupabase` marker at lines 9–14). Table blocks: `cv_items`
17–49, `cv_lines` 50–85, `cv_sections` 86–111, `cvs` 112–146. **No `gen:types` npm
script exists** (`package.json` only has `dev`/`build`/`lint`/`format`/`typecheck`/
`preview`/`seed`) — regenerate via the `mcp__claude_ai_Supabase__generate_typescript_types`
MCP tool after the migration lands, then overwrite this file.

### Data access layer

`src/lib/cv.ts` (395 lines) is **dead code** — zero imports anywhere in `src/` (grepped
`lib/cv"`), and stale relative to `src/mocks/cv.ts` (missing `contactParts`, entry
`kind`/`dateRangeText`/`keywords`, added later per progress row 14). Delete it rather
than fix it up — it was never wired to anything, and per CLAUDE.md, don't carry code
for a hypothetical future cutover that isn't this plan's job. The real Supabase-backed
layer gets authored whenever CVs actually cut over to Supabase (still deferred per
progress row 13), at which point it should be written fresh against the new schema
directly, not patched from this stale file.

`src/lib/cv-templates.ts` (43 lines) is untouched by this plan — pure static data
(`cvTemplates`, line 31), no table coupling. It's exactly the source spec 06 means by
"matches the static ids in `src/lib/cv-templates.ts`" for the new `cvs.template_id`
column.

`src/lib/inventory-store.tsx` — confirmed zero `cv_*` references. Not in scope.

### Mocks (the layer actually used live)

`src/mocks/cv.ts` (435 lines) is imported by 11 files — this is real, live code, not
dead like `lib/cv.ts`. Full export list and line numbers captured in Phase 2 below.
`src/mocks/data/cvs.ts` (132 lines) holds the two seed rows (`cv-backend`,
`cv-lead`) — these are Personas under the new model. `src/mocks/types.ts` has
`DbCv`/`DbCvSection`/`DbCvItem`/`DbCvLine`/`SourceCv*` types at lines 101–163.
`src/mocks/index.ts:220–222` and `src/mocks/README.md:33–36,67–70` have prose
referencing "CV" in the content-selection sense.

### Pages, components, routing

`src/pages/cvs.tsx` (83 lines), `src/pages/cv-print.tsx` (102 lines),
`src/pages/templates.tsx` (63 lines), `src/components/inventory/add-to-cv-dialog.tsx`
(126 lines) — full breakdown in Phase 3/4. Routes mounted in `src/App.tsx:74–76`:
```
74:  <Route path="cvs" element={<CvsPage />} />
75:  <Route path="cvs/:cvId/print" element={<CvPrintPage />} />
76:  <Route path="templates" element={<TemplatesPage />} />
```
`src/components/cv/*` (6 files: `preview-select.tsx`, `resume-render.tsx`,
`template-card.tsx`, `template-node-renderer.tsx`, `template-view-dialog.tsx`,
`templates/index.tsx`) all consume the already-resolved `ResumeDocument` shape and only
need import-path updates, no logic changes.

`src/components/inventory/item-detail-dialog.tsx` (usage section ~lines 114–452) and
`src/components/inventory/columns.tsx` (`"In CVs"` column, lines 9,20–22,25,42) both
read from `@/mocks/cv` for reverse-lookup ("which CVs use this item") — becomes "which
Personas use this item" under the new model.

### Navigation

`src/lib/navigation.ts` — `sections.cvs` (266–277) and `sections.templates` (278–289)
are flat single-page entries today. The reusable multi-page pattern already exists as
`inventoryPages` (46–203) + `inventoryGroups` (208–238), and `getBreadcrumbTrail`
(328–340) special-cases the `/inventory/` prefix at line 335. This plan adds an
equivalent (much smaller — 2 pages, no grouping needed) structure for CVs, and a second
prefix branch in `getBreadcrumbTrail`.

### Seed script

`scripts/seed.ts` — doc comment 12–13 lists tables to truncate; imports `sourceCvs`
from `mocks/data/cvs` (41) and `SourceCvLines` (43); insert loop 218–262 into
`cvs`/`cv_sections`/`cv_items`/`cv_lines`; count assertions at 264/270 (`cvs: 2`).

---

## Phase 1 — Database migration

**What to implement.** One new migration file,
`supabase/migrations/<timestamp>_persona_cv_split.sql`:

```sql
-- Rename the existing content-selection tables (data-preserving rename, not drop/recreate —
-- the remote project already has seeded rows in these tables).
alter table cvs rename to personas;
alter table cv_sections rename to persona_sections;
alter table cv_items rename to persona_items;
alter table cv_lines rename to persona_lines;

alter table persona_sections rename column cv_id to persona_id;
alter table persona_items rename column cv_id to persona_id;
alter table persona_lines rename column cv_id to persona_id;
-- persona_lines.item_id is unchanged (it's the FK target column name, not a cv_id column).

alter function cv_line_belongs_to_item() rename to persona_line_belongs_to_item;

-- New table: a saved (Persona, Template) pairing. This is the new meaning of "cvs".
create table cvs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  template_id text not null,
  name text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch before update on cvs
  for each row execute function touch_updated_at();

alter table cvs enable row level security;

create policy "own rows" on cvs
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on cvs (user_id);
create index on cvs (persona_id);
```

Apply it with `mcp__claude_ai_Supabase__apply_migration` against the real project
(`artmbeeadepxggbvfkdr`, per progress row 13) — this is a live project with real seeded
rows, not a fresh sandbox.

**`template_id` is intentionally `text`, not a foreign key** — no `cv_templates` table
exists yet (progress row 14: "Planned — not started"). Tighten to a real FK once that
table lands; not this plan's job.

**Documentation references.** Spec 06 §Tables for the exact column list; the original
migration (`20260805193855_cv_schema.sql`, quoted in Phase 0 above) for the shape being
renamed.

**Verification checklist.**
- `mcp__claude_ai_Supabase__list_tables` shows `personas`, `persona_sections`,
  `persona_items`, `persona_lines`, `cvs` (new shape) — not the old names.
- `select count(*) from personas;` returns `2` (the pre-existing seed rows survived
  the rename).
- `select * from pg_policies where tablename in ('personas','persona_sections',
  'persona_items','persona_lines','cvs');` shows policies intact and referencing the
  new names.
- `mcp__claude_ai_Supabase__get_advisors` (security + performance) comes back clean,
  matching the "zero advisor findings" bar set in progress row 13.

**Anti-pattern guards.** Don't `drop table` and recreate — that discards the seeded
rows. Don't hand-rewrite the RLS policy bodies — the rename cascades automatically;
rewriting risks introducing a typo Postgres would otherwise have prevented.

---

## Phase 2 — Regenerate types, rename the mocks layer

**What to implement.**

1. Regenerate `src/lib/database.types.ts` via
   `mcp__claude_ai_Supabase__generate_typescript_types` now that Phase 1's migration is
   live. Overwrite the file wholesale — it's fully generated, never hand-edited.

2. Delete `src/lib/cv.ts` (dead code, see Phase 0).

3. Rename `src/mocks/cv.ts` → `src/mocks/persona.ts`. Rename every export for the new
   vocabulary (content selection = Persona, no layout):
   - `cvRows`/`cvSectionRows`/`cvItemRows`/`cvLineRows` → `personaRows`/
     `personaSectionRows`/`personaItemRows`/`personaLineRows`
   - `cvDb` → `personaDb` (fields `cvs`→`personas`, `cvSections`→`personaSections`,
     `cvItems`→`personaItems`, `cvLines`→`personaLines`)
   - `allCvs()` → `allPersonas()`
   - `findCv(cvId)` → `findPersona(personaId)`
   - `cvsUsingItem(itemId)` → `personasUsingItem(itemId)`
   - `cvUsageCount(itemId)` → `personaUsageCount(itemId)`
   - `buildResumeDocument(cvId)` → `buildResumeDocument(personaId)` (name can stay —
     it already describes what it returns, not what it's keyed by; only the parameter
     changes meaning)
   - `toEntry(cvId, item, kind)` → `toEntry(personaId, item, kind)`
   - Keep `ResumeLineGroup`/`ResumeEntry`/`ResumeSection`/`ResumeDocument` types here —
     they're the resolved-content shape a Persona produces, independent of any
     template.

4. Rename `src/mocks/data/cvs.ts` → `src/mocks/data/personas.ts`. Rename its export
   `cvs`/`SourceCv` → `personas`/`SourcePersona` (and the two seed ids `cv-backend`/
   `cv-lead` can stay as-is or become `persona-backend`/`persona-lead` — prefer
   renaming them too, for consistency, since nothing external depends on the literal
   id strings). Update the file's doc comment (currently "Two CVs built from the same
   Inventory") to say "Personas."

5. Update `src/mocks/types.ts`: `DbCv`→`DbPersona`, `DbCvSection`→`DbPersonaSection`,
   `DbCvItem`→`DbPersonaItem`, `DbCvLine`→`DbPersonaLine`, `SourceCvLines`→
   `SourcePersonaLines`, `SourceCvItem`→`SourcePersonaItem`, `SourceCvSection`→
   `SourcePersonaSection`, `SourceCv`→`SourcePersona`. Update the section header
   comments (currently around lines 93, 141) accordingly.

6. Create `src/mocks/cv.ts` (new meaning) and `src/mocks/data/cvs.ts` (new meaning):
   - `src/mocks/data/cvs.ts`: 1–2 example rows, each `{ id, personaId, templateId,
     name, note }`, where `personaId` references one of the renamed persona seed ids
     and `templateId` is one of the real ids from `cvTemplates` in
     `src/lib/cv-templates.ts`.
   - `src/mocks/cv.ts`: `type DbCv = { id, userId, personaId, templateId, name, note,
     createdAt, updatedAt }`; `cvDb`; `allCvs(): DbCv[]`; `findCv(cvId): DbCv |
     undefined`. Also a small resolver used by the print page: `resolveCv(cvId):
     { cv: DbCv; document: ResumeDocument; template: CvTemplate } | undefined` that
     composes `findCv` + `buildResumeDocument(cv.personaId)` (from `mocks/persona.ts`)
     + a lookup into `cvTemplates` by `cv.templateId`. This keeps the "look up a saved
     CV and get everything needed to render it" logic in one place instead of
     duplicating it in the print page component.

7. Update `src/mocks/index.ts:220–222`'s doc comment (`cv_items.position` →
   `persona_items.position`) and `src/mocks/README.md:33–36,67–70`'s prose ("a CV
   picks between them" → "a Persona picks between them", etc.) — content-selection
   sense becomes Persona throughout.

**Documentation references.** Spec 06 §Terminology for the exact before/after mapping;
Phase 0's export inventory above for exact current names.

**Verification checklist.**
- `npm run typecheck` passes (will fail loudly everywhere an old import/name survives —
  use these failures as a checklist, don't just fix until clean and stop reading them).
- `grep -rn "cvDb\|findCv(\|allCvs(\|cvsUsingItem\|cvUsageCount" src/mocks/persona.ts`
  returns nothing (old names fully gone from the renamed file).
- `src/lib/cv.ts` no longer exists.

**Anti-pattern guards.** Don't leave `src/mocks/cv.ts` re-exporting the old names "for
compatibility" — CLAUDE.md explicitly rules out that kind of shim, and every caller is
being updated in Phase 3/4 anyway. Don't invent extra mutator functions
(`createPersona`, `updatePersona`, etc.) — there's no builder UI in this plan to call
them, and CLAUDE.md says no half-finished implementations.

---

## Phase 3 — Pages, routing, navigation

**What to implement.**

1. **`src/pages/cvs.tsx` → `src/pages/personas.tsx`.** Same list-table behavior as
   today (Name/Headline/Sections/Entries/Note columns per Phase 0), rename the
   component `CvsPage`→`PersonasPage`, swap `@/mocks/cv` import for
   `@/mocks/persona` (`allCvs`→`allPersonas`, `buildResumeDocument` takes a
   `personaId` now).

2. **New `src/pages/cvs.tsx`** — list of saved CVs (the new meaning). Mirrors the
   simplicity of the page it replaces: a table of `allCvs()` rows (from the new
   `@/mocks/cv`) showing Name, which Persona, which Template (look up template name
   from `cvTemplates` by `templateId`), Note. Row click → `/cvs/:cvId/print`. No
   create/edit UI (see the plan's opening scope note — no builder exists for Personas
   either).

3. **`src/pages/cv-print.tsx`** — replace the ad hoc `useState(cvTemplates[0].id)`
   template picker (current lines 58–62) with resolution through the new `cvs` table:
   `const resolved = cvId ? resolveCv(cvId) : undefined` (from `@/mocks/cv`, added in
   Phase 2 step 6), then render `resolved.document` under `resolved.template.id` —
   fixed to what the saved CV specifies, no dropdown. This is the concrete form of
   spec 06's "a CV is a persisted (Persona, Template) pairing" — once you're viewing a
   saved CV, that pairing is what renders, not an ephemeral picker.

4. **`src/pages/templates.tsx`** — this page's ad hoc "pick any Persona, pick any
   template, just look" flow is explicitly kept per spec 06 ("ad hoc preview stays
   free"). Only rename: local state `cvId`/`setCvId` (line 18) → `personaId`/
   `setPersonaId`, import swap `allCvs`→`allPersonas` from `@/mocks/persona`. No
   behavior change — this page still never saves anything.

5. **`src/components/inventory/add-to-cv-dialog.tsx` → `add-to-persona-dialog.tsx`.**
   Component `AddToCvDialog`→`AddToPersonaDialog`, dialog title "Add to CV"→"Add to
   Persona", import `allCvs`/`cvsUsingItem`→`allPersonas`/`personasUsingItem` from
   `@/mocks/persona`. Update its call site (wherever it's opened from in the Inventory
   pool pages/detail dialog) to the new component/file name.

6. **`src/components/cv/*`** (6 files, Phase 0 list) — update their `@/mocks/cv`
   imports to `@/mocks/persona` for `ResumeDocument`/`ResumeSection`/`ResumeEntry`
   types (these types now live there per Phase 2 step 3). `resume-render.tsx`,
   `template-card.tsx`, `template-node-renderer.tsx`, `template-view-dialog.tsx`,
   `templates/index.tsx` need no logic changes, just the import path.

7. **`src/App.tsx`** routes (currently lines 74–76): replace with
   ```tsx
   <Route path="cvs" element={<CvsPage />} />
   <Route path="cvs/:cvId/print" element={<CvPrintPage />} />
   <Route path="cvs/personas" element={<PersonasPage />} />
   <Route path="templates" element={<TemplatesPage />} />
   ```
   `/cvs` keeps its current URL but now serves the new CVs (saved pairings) list;
   `/cvs/personas` is the new nested page. This mirrors Inventory's own
   `/inventory` + `/inventory/basics` nesting instead of inventing a new pattern.

8. **`src/lib/navigation.ts`**:
   - Add a `cvPages` record (mirrors `inventoryPages`'s shape, just one entry):
     ```ts
     export const cvPages = {
       personas: {
         path: "/cvs/personas",
         title: "Personas",
         description:
           "Named, reusable selections of entries and bullets from your Profile — no layout yet.",
         icon: ..., // pick a distinct icon from the existing lucide-react set already imported
         empty: {
           title: "No Personas yet",
           body: "A Persona is a selection from your Profile — content only, no layout. Pair one with a Template to get a CV.",
           action: "Create a Persona",
         },
       },
     } satisfies Record<string, NavPage>
     ```
   - Update `sections.cvs` (266–277): title stays "CVs", but description/empty copy
     changes to describe the new meaning — "A CV pairs a Persona with a Template" —
     not "composed by selecting entries and bullet points" (that's Persona's
     description now).
   - Add `cvPages.personas` to `allPages` (currently built at line ~315 from
     `sections` + `inventoryPages`).
   - `getBreadcrumbTrail` (328–340): add a second prefix branch,
     `if (page.path.startsWith("/cvs/"))`, alongside the existing `/inventory/` one at
     line 335, so `/cvs/personas` breadcrumbs as [CVs, Personas].

**Documentation references.** Spec 06 §Navigation for the two-peer-page requirement
(this plan resolves "route slugs are implementation detail" left open there). Phase 0's
exact current route/nav line numbers above.

**Verification checklist.**
- `npm run typecheck` and `npm run lint` pass.
- Manual nav check: sidebar shows CVs expanding to reveal Personas (or however the
  existing Inventory-nesting sidebar component renders `inventoryPages` — reuse that
  same rendering, don't build a second nav pattern).
- `/cvs` renders the saved-pairing list; `/cvs/personas` renders the content-selection
  list; `/cvs/:cvId/print` renders a fixed persona+template with no dropdown;
  `/templates` still free-previews any Persona under any template.
- Breadcrumb on `/cvs/personas` reads CVs → Personas.

**Anti-pattern guards.** Don't add a template override dropdown to the new
`cv-print.tsx` — spec 06 draws the line there deliberately (a saved CV is the fixed
pairing; ad hoc override belongs on the Templates page, which already has it). Don't
build a "New CV" or "New Persona" creation dialog — out of scope, no builder existed
before this plan and this plan doesn't add one.

---

## Phase 4 — Inventory-side usage references

**What to implement.**

1. **`src/components/inventory/item-detail-dialog.tsx`** — the "Used in CVs" section
   (Phase 0: lines ~114–452) reads `cvsUsingItem` to show which CVs reference an
   Inventory entry. Under the new model this is inherently a Persona-level fact (a
   Persona selects entries; a CV just wraps a Persona in a template), so: import
   `personasUsingItem` from `@/mocks/persona` instead of `cvsUsingItem` from
   `@/mocks/cv`, relabel the section "Used in Personas", and change the link at line
   ~449 from `/cvs/${cv.id}/print` to `/cvs/personas` (or a persona detail route if one
   exists by then — today there's no per-persona detail page, so link to the Personas
   list, consistent with there being no builder to deep-link into).

2. **`src/components/inventory/columns.tsx`** — `"In CVs"` column header (line 25) and
   its `aria-label` (line 42, "used in N CV/CVs") become `"In Personas"` / "used in N
   Persona/Personas", backed by `personaUsageCount` from `@/mocks/persona` instead of
   `cvUsageCount` from `@/mocks/cv`.

**Documentation references.** Spec 06 §Terminology (content-selection = Persona).
Phase 0's exact line numbers for both files.

**Verification checklist.**
- `npm run typecheck` passes.
- Open an Inventory pool page (e.g. `/inventory/work`) in the browser, confirm the
  usage column reads "In Personas" and the count matches; open an item's detail
  dialog, confirm "Used in Personas" with working links.
- No remaining `cvsUsingItem`/`cvUsageCount` references anywhere in `src/components/`
  (`grep -rn "cvsUsingItem\|cvUsageCount" src/components/` returns nothing).

**Anti-pattern guards.** Don't rename these to reference the new `cvs` meaning instead
— that would be wrong: an Inventory item's usage is a Persona-level fact, not
CV-level, per spec 06's model (a CV has no content of its own, only a Persona + a
Template pointer).

---

## Phase 5 — Seed script, docs, final verification

**What to implement.**

1. **`scripts/seed.ts`**: rename every `.from("cvs")`/`.from("cv_sections")`/
   `.from("cv_items")`/`.from("cv_lines")` (lines 218–262 per Phase 0) to
   `.from("personas")`/`.from("persona_sections")`/`.from("persona_items")`/
   `.from("persona_lines")`. Update the import at line 41 from `sourceCvs` (
   `mocks/data/cvs`) to `personas` (`mocks/data/personas`, per Phase 2 step 4). Update
   the doc comment at lines 12–13 (truncate list) and the count assertions at
   264/270 to say Personas. **Add a second insert block** after the persona inserts,
   writing the new `mocks/data/cvs.ts` rows into the real `cvs` table (Phase 1's new
   table) — same pattern as the persona insert loop, just one row per entry (no nested
   sections/items/lines to expand, since a CV only has `persona_id`/`template_id`/
   `name`/`note`). Update the expected-count assertion to include the new `cvs` count.
   Re-run the seed script against the real project (per progress row 13's precedent —
   it signs in as the real account, no service-role key needed) and confirm exact
   counts match, same bar as before.

2. **`docs/progress.md` row 16** — already added in this session pointing at
   `specs/06-persona-cv-split.md` with Status "Draft" and Plan column `—`. Update the
   Plan column to link this file
   (`[plans/08](plans/08-persona-cv-split.md)`), and once all phases above are
   executed and verified, flip Status from "Draft" to something like "Done — verified
   in browser" (matching this repo's existing status vocabulary, e.g. rows 12/15),
   with a Notes update summarizing what actually shipped (mirroring the level of
   detail rows 13/15 use — real file names, real counts, what was verified live).

3. **Full verification pass**:
   - `npm run typecheck`, `npm run lint`, `npm run build` all clean.
   - `grep -rn "cv_id\|cvId\b" src/ scripts/` reviewed by hand — every remaining hit
     should be either (a) the new `cvs` table's own legitimate `cv_id`-shaped column
     names if any were introduced (there shouldn't be any — the new table uses
     `persona_id`, not `cv_id`), or (b) something genuinely unrelated. Anything else
     is a missed rename.
   - Browser check (per CLAUDE.md's "Verifying UI work" — one desktop screenshot per
     changed page plus console-error check): `/cvs`, `/cvs/personas`,
     `/cvs/:cvId/print` (pick a real seeded id), `/templates`, and one Inventory pool
     page for the "In Personas" column + detail dialog.

**Documentation references.** Progress row 13 for the seed script's existing
sign-in-as-real-account pattern and exact-count-match bar; rows 12/15 for the
Status/Notes vocabulary to match when closing this row out.

**Verification checklist.** All of the above, plus: re-running `scripts/seed.ts` a
second time should fail cleanly the same way it presumably does today on a
double-run (not introducing a new failure mode) — check the script's existing
duplicate-run handling before assuming this needs new code.

**Anti-pattern guards.** Don't mark progress row 16 "Done" without the browser checks
actually having happened — this repo's own convention (rows 12/15) is explicit about
what "verified in browser" means and doesn't award it for typecheck-only passes.

---

## Open items carried forward (not this plan's job)

Per spec 06 §Open points, unchanged by this plan:
1. Per-CV ordering override — deferred.
2. `cvs.template_id` becomes a real FK once `cv_templates` (progress row 14) exists.
3. Applications binding — still unspecced.
4. Inventory/Profile code-naming drift — separate cleanup.
