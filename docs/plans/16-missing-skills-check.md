# 16 — Missing skills check

Spec: [specs/14-missing-skills-check.md](../specs/14-missing-skills-check.md)

## Why (context a fresh session needs)

A job posting lists required skills; the user wants to paste that list and see which
of those skills aren't covered — by a specific Application's attached CV, a specific
CV directly, or a Persona's full skill selection. One reusable dialog
(`SkillsCheckDialog`) does the check in all three places. Only the Application
context persists anything to the database; CV-page and Persona-page checks are
in-memory only (gone on refresh).

## Locked-in decisions (from the spec — do not re-open)

- Matching is exact, case-insensitive, trimmed. No substring/fuzzy matching.
- Compare pool:
  - **Application**: `resolveApplicationCv(...).document`'s `skill` section,
    `skillGroups[].skills` flattened. Disabled if no CV attached.
  - **CV page**: same shape — the page's already-resolved `document`'s `skill`
    section, `skillGroups[].skills` flattened. Already reflects that CV's own
    field-visibility overrides.
  - **Persona page**: the persona's own `buildResumeDocument(...)` (already computed
    on that page for the section cards) — same `skill` section /
    `skillGroups[].skills` flattening. Persona documents carry no field-visibility
    filtering, so this is the persona's full selected skill set.
- Dialog is a dumb, controlled component — it never fetches or persists. Callers own
  `value` (textarea text) and `result` (last computed missing-skills array or
  `null`), and `onCheck` recomputes them.
- Application-only: **Check** inside the dialog only recomputes `result` locally.
  Persisting `required_skills_input`/`missing_skills` to the database happens via a
  separate **Save** action, shown only in the Application context.
- CV-page and Persona-page: no Save action at all, no database columns touched, no
  display outside the dialog. State is plain `useState` in the host component/page —
  lost on navigation or refresh, by design.
- Only `applications` gets new columns. Nothing added to `cvs` or `personas`.

## Current-state summary (confirmed via direct file reads)

- `ResumeDocument`/`ResumeSection` (`src/lib/resume-document.ts:48-54`): a `skill`
  section carries `skillGroups?: ResumeSkillGroup[]`, each
  `{ category: string; skills: string[] }`. This is already fully resolved/filtered
  by the time a page has a `document` — no extra filtering needed by this feature.
- `src/pages/cv-print.tsx` (`CvResolved`, ~line 61-128): already has `document:
  ResumeDocument` and `template` as props, computed once by `resolveCv` in the parent.
  Header row (~line 84-108) has Export/Print buttons — the natural place for a new
  "Check skills" trigger. No existing dialog-open state on this page (plain
  component, no `useDialogSearchParams`).
- `src/pages/persona-detail.tsx`: `const document = buildResumeDocument(personaStore,
  inventoryStore, persona.id)` (line 121); `sectionByKind` map built at line 125-127.
  `SectionCard` (line 460-507) renders each kind's `CardHeader` with a `CardAction`
  containing `PickButton` (line 473-475). Skill kind is one of `secondaryKinds`
  (rendered line 327-334, right column). Dialog-open state on this page uses
  `useDialogSearchParams()` → `open("pool-picker", { kind })` (already imported/used
  at line ~28 area, confirm import when editing).
- `src/components/applications/application-detail-view.tsx`: `DetailField` (line
  45-52) is the label/value row primitive; `JobMetaFields`/`SourceUrlField`/
  `NoteAndTagsFields` (lines 59-116) are the existing shared field-group components,
  reused by both the `"page"` and `"sheet"` variants of `JobDetailTab` (line 167-232).
  `ApplicationDetailView` (line 243+) already computes `resolvedCv =
  resolveApplicationCv(application, personaStore, inventoryStore)` (line 267) and uses
  `useDialogSearchParams()` for the freeze-CV confirmation (`freezeDialog`, line 256).
  Reuse that same hook for the new Skills-check dialog's open state (a second
  independent key, e.g. `"skills-check"`).
- `src/lib/application.ts`: `updateApplication` (~line 187) already does a
  conditional per-field patch (`...(patch.x !== undefined ? {...} : {})`) against
  `ApplicationFormFields` (line ~118-133). Adding two more optional fields here is a
  pure extension of the existing pattern — no new mutator needed.
- `src/lib/application-store.tsx`: `mapApplicationRow` (line 41-66) maps every
  snake_case DB column to a camelCase `DbApplication` field — extend it the same way.
- `src/mocks/types.ts`: `DbApplication` (line 320-341) is the camelCase shape used
  everywhere in the UI — add the two new fields here.
- `src/components/ui/badge.tsx`: `variant="destructive"` → `bg-destructive/10
  text-destructive` (line 15-16 of the cva config) — this is the exact class already
  used for other destructive badges in the app (e.g. tag-dialogs). Badge already
  supports a leading icon via `data-icon="inline-start"` (CSS hook
  `has-data-[icon=inline-start]:pl-1.5` in the base `badgeVariants` string) — same
  convention used on `Button`/`PencilIcon` elsewhere; not yet used on a `Badge` in
  this codebase, but the CSS support is already there.
- `lucide-react` exports `TriangleAlert` (confirmed in
  `node_modules/lucide-react/dist/lucide-react.d.ts`) — import as `TriangleAlert`
  from `"lucide-react"`.
- `src/components/ui/textarea.tsx` and `src/components/ui/dialog.tsx` already exist
  and need no changes — reuse as-is (`Textarea`, `Dialog`/`DialogContent`/
  `DialogHeader`/`DialogTitle`/`DialogBody`/`DialogFooter`, matching
  `application-form-dialog.tsx`'s import list).
- Latest migration: `supabase/migrations/20260811123121_add_cv_templates.sql`. The
  most directly comparable prior migration for an additive `alter table` is
  `20260811000956_add_application_job_fields.sql` — plain `alter table
  public.applications add column ...`, no RLS/trigger changes needed since
  `applications` already has RLS + the `touch` trigger covering all columns.

## Data model

### Migration — `supabase/migrations/20260816050000_add_application_skill_check.sql`

```sql
-- Manual "missing skills" check against a job posting's required-skills list,
-- run from the Application detail page against the attached CV's resolved
-- skills. See docs/specs/14-missing-skills-check.md.
alter table public.applications
  add column required_skills_input text,
  add column missing_skills text[];
```

No RLS/trigger changes — both are nullable columns on an already-RLS'd,
already-`touch`-triggered table, following the exact pattern of
`20260811000956_add_application_job_fields.sql`.

### Type changes

- `src/mocks/types.ts` — `DbApplication` (line ~320-341): add
  ```ts
  requiredSkillsInput: string | null
  missingSkills: string[] | null
  ```
  right after `coverLetter` (keeps related free-text fields adjacent) or at the end
  before `archivedAt` — either is fine, match surrounding style.
- `src/lib/application-store.tsx` — `mapApplicationRow` (line 41-66): add
  ```ts
  requiredSkillsInput: row.required_skills_input,
  missingSkills: row.missing_skills,
  ```
- `src/lib/application.ts` — `ApplicationFormFields` type (~line 118-133): add
  `requiredSkillsInput?: string | null` and `missingSkills?: string[] | null`.
  `updateApplication`'s patch object (~line 187+): add
  ```ts
  ...(patch.requiredSkillsInput !== undefined
    ? { required_skills_input: patch.requiredSkillsInput }
    : {}),
  ...(patch.missingSkills !== undefined ? { missing_skills: patch.missingSkills } : {}),
  ```
  `createApplication` is untouched — new applications simply start with both `null`.
- `src/lib/database.types.ts` — regenerate via the Supabase MCP
  (`mcp__claude_ai_Supabase__generate_typescript_types`) after the migration is
  applied. **Never hand-edit this file.**

## Phase 1 — Database migration

1. Load the `supabase` skill before touching anything Supabase-related (schema
   changes, migration conventions may have moved since training data).
2. Write the migration file exactly as in "Data model" above.
3. Apply it (local dev stack per the `supabase` skill's guidance, or via
   `mcp__claude_ai_Supabase__apply_migration` if working directly against the remote
   project — check which this repo's existing workflow uses first, e.g. whether a
   local Supabase stack is already running).
4. Regenerate `src/lib/database.types.ts` via
   `mcp__claude_ai_Supabase__generate_typescript_types` (or the local CLI equivalent
   the `supabase` skill points you to) — confirm `applications.Row` now has
   `required_skills_input: string | null` and `missing_skills: string[] | null`.

**Verification**: `grep -n "required_skills_input\|missing_skills"
src/lib/database.types.ts` shows both columns on the `applications` table's `Row`/
`Insert`/`Update` shapes. `mcp__claude_ai_Supabase__get_advisors` (type `security`)
shows no new findings.

## Phase 2 — Shared skill-check lib + dialog

1. **`src/lib/skill-check.ts`** (new):
   ```ts
   /** One skill line, trimmed and matched case-insensitively against `availableSkillTitles`. */
   export function findMissingSkills(
     input: string,
     availableSkillTitles: string[]
   ): string[] {
     const available = new Set(availableSkillTitles.map((s) => s.trim().toLowerCase()))
     const seen = new Set<string>()
     const missing: string[] = []

     for (const rawLine of input.split("\n")) {
       const line = rawLine.trim()
       if (!line) continue
       const key = line.toLowerCase()
       if (seen.has(key)) continue
       seen.add(key)
       if (!available.has(key)) missing.push(line)
     }

     return missing
   }

   /** A resolved `ResumeDocument`'s skill titles, flattened across categories — the shared compare-pool shape for Applications/CV-page/Persona-page. */
   export function skillTitlesOf(document: { sections: { kind: string; skillGroups?: { skills: string[] }[] }[] }): string[] {
     const skillSection = document.sections.find((section) => section.kind === "skill")
     return skillSection?.skillGroups?.flatMap((group) => group.skills) ?? []
   }
   ```
   Prefer typing `skillTitlesOf`'s parameter as `ResumeDocument` directly (import
   from `@/lib/resume-document`) rather than the inline structural type above — the
   inline type is only there to show the shape; use the real import in the actual
   file.
2. **`src/components/skills/skills-check-dialog.tsx`** (new) — controlled dialog per
   the spec's shape:
   ```ts
   export function SkillsCheckDialog({
     open,
     onOpenChange,
     value,
     onValueChange,
     result,
     onCheck,
     extraFooter,     // Application context's Save button; undefined elsewhere
     disabledReason,  // e.g. "Select a CV first" — disables textarea/Check when set
   }: {
     open: boolean
     onOpenChange: (open: boolean) => void
     value: string
     onValueChange: (value: string) => void
     result: string[] | null
     onCheck: () => void
     extraFooter?: React.ReactNode
     disabledReason?: string
   })
   ```
   Structure: `Dialog` > `DialogContent` > `DialogHeader`/`DialogTitle` ("Check
   missing skills") > `DialogBody` with a `Textarea` (placeholder "Paste required
   skills, one per line") + Check `Button`, then — when `result !== null` — either
   "All covered" (neutral, `result.length === 0`) or a `flex flex-wrap gap-1` of
   `Badge variant="destructive"` with a leading `<TriangleAlert data-icon="inline-start" />`,
   one per missing skill. `DialogFooter` has Close plus whatever `extraFooter` passes
   in (the Applications context's Save button — keeps the dialog itself unaware of
   persistence).
3. Copy the `Field`/`FieldLabel`/`Textarea` composition style from
   `application-form-dialog.tsx`'s `vacancy-detail` `Field` (line 292-300) for visual
   consistency, and the destructive-badge composition from `badge.tsx`'s
   `variant="destructive"` (no existing call site to copy verbatim — first usage).

**Verification**: `npm run typecheck` passes with the new files in isolation (no
other files import them yet). Manually trace `findMissingSkills("React\nreact\n \nSQL", ["React", "Node"])` → `["SQL"]` (dedupes the two "react" lines, drops the blank, "React" matches case-insensitively).

## Phase 3 — Application context (persisted)

1. In `src/components/applications/application-detail-view.tsx`:
   - Add `skillCheckDialog = useDialogSearchParams()` alongside the existing
     `freezeDialog`, using a distinct key (`"skills-check"`).
   - Local state for the dialog's `value`/`result`, seeded from
     `application.requiredSkillsInput ?? ""` / `application.missingSkills` when the
     dialog transitions open (same `wasOpen`-diff seeding pattern used in
     `application-form-dialog.tsx` lines 108-129 — or simpler, since this dialog has
     only two fields: seed in the `onOpenChange(true)` handler).
   - `availableSkills = resolvedCv ? skillTitlesOf(resolvedCv.document) : []`
     (`resolvedCv` already computed at line 267).
   - Trigger button (disabled with `disabledReason="Select a CV first"` when
     `!application.cvId`) placed in the sidebar column, near the existing `CV`
     `DetailField` (both `"page"` and `"sheet"` variants of `JobDetailTab` — same
     approach as `NoteAndTagsFields`, a small shared component so the two variants
     don't drift).
   - `extraFooter`: a Save `Button` calling `updateApplication(applicationStore,
     application.id, { requiredSkillsInput: value || null, missingSkills: result })`
     then closing the dialog.
   - New `MissingSkillsField` (mirrors `SourceUrlField`'s shape, line 59-72): renders
     `application.missingSkills` as destructive badges, or `"—"` when
     `null`/empty. Placed in both `JobDetailTab` variants next to `CV`.
2. **Do not** touch `application-form-dialog.tsx` — required-skills input/checking
   is no longer part of that form (superseded by this plan's dialog).

**Verification**: `npm run typecheck && npm run lint`. Confirm
`MissingSkillsField`/trigger button appear identically in both `variant="page"` and
`variant="sheet"` renders (same component reused, not copy-pasted).

## Phase 4 — CV page context (ephemeral)

1. In `src/pages/cv-print.tsx`'s `CvResolved`:
   - `const [dialogOpen, setDialogOpen] = React.useState(false)`,
     `const [requiredSkillsInput, setRequiredSkillsInput] = React.useState("")`,
     `const [missingSkills, setMissingSkills] = React.useState<string[] | null>(null)`.
   - `availableSkills = skillTitlesOf(document)` (the `document` prop already in
     scope).
   - New Button "Check skills" in the header row (~line 84-108, alongside
     Export/Print).
   - `onCheck={() => setMissingSkills(findMissingSkills(requiredSkillsInput, availableSkills))}`.
   - No `extraFooter`, no `disabledReason` (a resolved CV always has a `document`).

**Verification**: `npm run typecheck && npm run lint`. No new props threaded onto
`CvResolved` from its caller — state is fully local to the component.

## Phase 5 — Persona page context (ephemeral)

1. In `src/pages/persona-detail.tsx`:
   - Same local `useState` trio as Phase 4 (`dialogOpen`/`requiredSkillsInput`/
     `missingSkills`), owned by the page component (not `SectionCard`, since
     `SectionCard` is generic across all kinds and shouldn't grow skill-specific
     state).
   - `availableSkills = skillTitlesOf(document)` (the page's existing `document`,
     line 121).
   - Extend `SectionCard` with an optional `extraAction?: React.ReactNode` prop,
     rendered in `CardAction` alongside the existing `PickButton` (line 473-475).
   - In the `secondaryKinds.map(...)` loop (line 327-334), when `kind === "skill"`,
     pass `extraAction={<Button size="sm" variant="ghost" onClick={() => setDialogOpen(true)}><TriangleAlert data-icon="inline-start" />Check skills</Button>}`.

**Verification**: `npm run typecheck && npm run lint`. Confirm the Check button only
appears on the Skills card, not on every `SectionCard`.

## Phase 6 — Verification

1. `npm run typecheck` and `npm run lint` clean across the whole repo (not just
   touched files — confirm no ripple breakage in `application-form-dialog.tsx` from
   the `ApplicationFormFields` type extension, since it destructures that type).
2. Grep check: `grep -rn "SkillsCheckDialog" src/pages src/components` shows exactly
   three call sites (application-detail-view, cv-print, persona-detail).
3. Confirm no stray references remain to skill-checking inside
   `application-form-dialog.tsx` (should be none — Phase 3 explicitly didn't touch
   that file).
4. Per CLAUDE.md, skip the browser visual check by default — this feature is
   data/logic-driven, not visual/responsive/theming, so typecheck+lint clean is
   sufficient unless the user asks for a visual pass.

## Phase 7 — Docs

1. `docs/code-map.md`:
   - Add `src/lib/skill-check.ts` — "Pure skill-matching helpers (`findMissingSkills`,
     `skillTitlesOf`) shared by the Application/CV/Persona missing-skills check" —
     under **Domain: Applications** (primary consumer) or a new one-line mention in
     **Shared UI / hooks** if that reads better once written.
   - Add `src/components/skills/skills-check-dialog.tsx` under **Shared UI / hooks**
     — "Reusable Check-missing-skills dialog (Application/CV/Persona contexts) —
     controlled, no fetch/persist of its own."
2. `docs/progress.md`: add a row for this initiative (spec 14 / plan 16), following
   the existing table format — link both docs, status "Done" once Phase 6 passes,
   short notes summarizing the three integration points and the DB columns added.
