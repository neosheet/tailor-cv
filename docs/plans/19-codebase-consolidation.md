# 19 — Codebase consolidation

Spec: [specs/17-codebase-consolidation.md](../specs/17-codebase-consolidation.md)

Structural-only cleanup, no user-visible behavior change. Six phases, ordered
cheapest/lowest-risk first. Every phase ends with `npm run typecheck` and
`npm run lint`; commit at the end of each phase per the standing commit
authorization in `CLAUDE.md`. Two spec items (#5 `ItemKind` config split, #8
shared template blocks) were dropped during doc-discovery — verified false
positive / verified intentional past decision, respectively. No phase
implements them; the spec records why.

## Phase 0 — Documentation discovery (done, folded into spec)

Findings baked into spec 17 already: exact `requireUserId` bodies (byte-
identical across all 5 files, differ only in the store-type param — all 3
store types have a `userId: string | null` field), `application.ts`'s
`findApplication`-or-throw block repeated 9 times, the style/node override
setters' two-level shallow-merge shape vs. the page setter's one-level shape,
`persona-field-tree.tsx`'s 1138-line/5-tab structure, `batch1-demo.ts`'s
listing in the production `cvTemplates` array, and the dialog/panel trio's
real (not just apparent) divergence — noted per-phase below where it matters.
No further discovery subagent needed; each phase below cites exact
file:line anchors to start from.

## Phase 1 — Shared `requireUserId` (small)

**What**: Add one generic function to `src/lib/store-context.ts`:

```ts
export function requireUserId<T extends { userId: string | null }>(store: T): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}
```

Delete the five local copies and import the shared one instead:
- `src/lib/tags.ts:101-106` (5 call sites)
- `src/lib/skill-categories.ts:60-65` (1 call site)
- `src/lib/inventory.ts:241-246` (1 call site)
- `src/lib/persona.ts:701-706` — **exported** (`application.ts:2` imports it
  aliased as `requirePersonaUserId`); update that import to point at
  `store-context.ts` instead, keep the alias.
- `src/lib/application.ts:187-192` (1 call site)

**Verification**: `grep -rn "function requireUserId" src/lib/` returns zero
matches (only the one in `store-context.ts`). `npm run typecheck && npm run lint`.

## Phase 2 — Demote `batch1-demo` out of the production template picker (small)

**What**: `src/lib/cv-templates.ts` lines ~1 and ~76-80 list
`batch1-demo` in the same `cvTemplates` array as `classic`/`classic-compact`/
`two-column`, despite the array/file's own docs elsewhere describing it as a
test surface. Read the full surrounding context in `cv-templates.ts` first
(the `CvTemplate[]` shape, `findTemplate`, `allTemplates`) before changing
anything, then gate it out of what real users see — e.g. filter it out of the
array exported for the picker (keep it reachable via `findTemplate` by id for
whatever dev/test path already references it directly, gate the picker-facing
list on `import.meta.env.DEV` or a separate array). Check
`src/components/cv/template-card.tsx` / `application-cv-setup.tsx` for
anywhere the full `cvTemplates` array is rendered as a user-facing list, and
confirm the gate actually removes it from those surfaces.

**Verification**: run the app (or grep call sites) to confirm `batch1-demo`
no longer appears in the template picker UI, but `findTemplate("batch1-demo")`
still resolves for any internal caller that needs it. `npm run typecheck && npm run lint`.

## Phase 3 — `application.ts` CV-override mutators (medium)

**What**: Two sub-cleanups in `src/lib/application.ts`:

1. Extract the repeated "look up the application or throw" block (appears at
   lines 579, 614, 644, 696, 719, 747, 766, 797, 820 — 9 occurrences of
   `const application = findApplication(store, applicationId); if (!application) { throw new Error(...) }`)
   into one helper, e.g. `getApplicationOrThrow(store, applicationId)`, and
   replace all 9 call sites.

2. Collapse the two save wrappers `saveApplicationCvPersonaSettings`
   (line 552-570) and `saveApplicationCvTemplateSettings` (line 663-681) —
   identical except the Supabase column name (`cv_persona_settings` vs.
   `cv_template_settings`) — into one generic
   `saveApplicationCvColumn(store, applicationId, column, next)` (or keep two
   thin typed wrappers calling one shared implementation, whichever reads
   better once written — the shared body is what matters, not the exact
   signature).

   Leave the setter/resetter pairs themselves
   (`setCvStyleProperty`/`resetCvStyleProperty` lines 689-733,
   `setCvPageProperty`/`resetCvPageProperty` lines 741-778,
   `setCvNodeOverride`/`resetCvNodeOverride` lines 791-834) as separate typed
   functions — styles/nodes are a two-level merge (`{[name]: {[key]: value}}`)
   and page is one-level (`{[key]: value}`), so a single fully-generic patch
   helper would need a merge-depth parameter for little real gain; a shared
   `getApplicationOrThrow` + shared save wrapper already removes most of the
   duplication without forcing an awkward abstraction on the differing merge
   shapes.

**Verification**: exercise the Style/Page/Block tabs in the CV editor
manually if convenient, or trust `npm run typecheck && npm run lint` plus a
read-through confirming every setter/resetter still shallow-merges the same
way as before the change (compare against the current bodies quoted in spec
17's discovery, or re-read the pre-change file).

## Phase 4 — Split `persona-field-tree.tsx` (medium)

**What**: `src/components/cv/persona-field-tree.tsx` is 1138 lines, 5
largely-independent tabs (`VisibilityTab` line 318, `DataTab` line 492,
`StyleTab` line 741, `PageTab` line 845, `BlockTab` line 899), each with its
own row/leaf sub-components (`EyeToggle` 119, `ReorderButtons` 141, `LeafRow`
173, `ParentRow` 200, `KindRow` 256 for Visibility; `ItemRow` 388/`ItemRowList`
466 for Data; `StyleValueControl` 574/`PropertyRow` 656/`AddStyleProperty` 694
for Style). Mirror the existing `persona-detail.tsx` →
`persona-editor-panel.tsx` extraction pattern already used elsewhere in this
codebase: create a `src/components/cv/persona-field-tree/` folder, move each
tab + its private sub-components into its own file
(`visibility-tab.tsx`, `data-tab.tsx`, `style-tab.tsx`, `page-tab.tsx`,
`block-tab.tsx`), keep `persona-field-tree.tsx` (or
`persona-field-tree/index.tsx`) as the thin `Tabs` shell (line 1068's
`PersonaFieldTree` export) that imports and wires them together. Update
`docs/code-map.md`'s `src/components/cv/persona-field-tree.tsx` entry to
reflect the new folder.

**Verification**: `npm run typecheck && npm run lint`; confirm no behavior
change (same exports, same props) — this is a pure file-split, not a rewrite.

## Phase 5 — Dialog shells for the settings registries (medium)

**What**: Read `src/components/settings/tag-dialogs.tsx`,
`skill-category-dialogs.tsx`, and `stage-template-dialogs.tsx` in full first.
`stage-template-dialogs.tsx` deliberately diverges (own doc comments explain
why — renames name+category together, no in-use copy, unconditional delete)
so do **not** build one rigid `RenameEntityDialog<T>`/`DeleteEntityDialog<T>`
with a fixed field/validator contract. Instead extract just the identical
layout skeleton as two presentational wrapper components (suggested location:
`src/components/settings/entity-dialog-shells.tsx` or similar):

- `RenameDialogShell({ open, onCancel, title, description, submitDisabled, onSubmit, children })`
  — wraps the `Dialog`/`form`/`DialogHeader`/`DialogTitle`/`DialogDescription`/
  `DialogFooter` Cancel+Submit(“Rename”) boilerplate common to all three
  `Rename*Dialog`s; `children` is the field(s) — one `Field`+`Input` for
  tags/categories, `Field`+`Input`+`Select` for stage templates.
- `DeleteConfirmDialogShell({ open, onCancel, onDelete, title, description, actionLabel })`
  — wraps the `AlertDialog`/`AlertDialogHeader`/`AlertDialogTitle`/
  `AlertDialogDescription`/`AlertDialogFooter` Cancel+destructive-Action
  boilerplate common to all three `Delete*Dialog`s.

Rewrite all six existing dialog components (`RenameTagDialog`,
`DeleteTagDialog` in `tag-dialogs.tsx`; `RenameSkillCategoryDialog`,
`DeleteSkillCategoryDialog` in `skill-category-dialogs.tsx`;
`RenameStageTemplateDialog`, `DeleteStageTemplateDialog` in
`stage-template-dialogs.tsx`) to use the shells, keeping each file's own
validation call, field set, and copy text exactly as-is — this phase changes
layout wiring only, never the actual validation/copy logic.

**Verification**: visually the three settings panels' rename/delete dialogs
must look and behave identically to before (same copy, same fields, same
validation). `npm run typecheck && npm run lint`.

## Phase 6 — Registry panel consolidation (medium-large, depends on Phase 5)

**What**: Read `src/components/settings/tags-panel.tsx`,
`skill-categories-panel.tsx`, `stage-templates-panel.tsx` in full first.
Note real differences already found: `tags-panel.tsx` has a bulk-selection/
bulk-action toolbar the other two don't (categories/stage-templates are
"just add, rename, delete, one row at a time" per `skill-categories-panel.tsx`'s
own doc comment); `stage-templates-panel.tsx`'s add-form and table likely
carry an extra category column/Select (mirroring its dialog). Don't force
tags' bulk-select machinery into a shape the other two must also carry.

Extract what's genuinely identical across all three — the search box +
table-with-hover-actions + empty-state shell (see
`skill-categories-panel.tsx:68-183` as the clean reference: `SearchInput`,
conditional `Empty`, `Table`/`TableHeader`/`TableBody` with a rename/delete
icon-button actions cell, `useDialogSearchParams`-driven `renaming`/`deleting`
lookup feeding the Phase 5 dialog shells) into a generic
`RegistryTable<T extends { id: string }>` component taking: `items`,
`columns` (header + cell renderer per column, so callers can add
stage-templates' category column or omit it), `getRowLabel`, `onRename`/
`onDelete` open-handlers, empty-state title/description/icon. Each panel
keeps its own state (query, `useDialogSearchParams`, store), its own
add-field component (different shape per registry), and its own dialogs (now
using Phase 5's shells) — only the table+search+empty-state markup moves into
the shared component. If `tags-panel.tsx`'s bulk-selection doesn't compose
cleanly with the shared table (e.g. it needs a checkbox column `RegistryTable`
doesn't support), extend `columns` to allow an optional leading
selection-checkbox column rather than leaving `tags-panel.tsx` unconsolidated
— but if that starts requiring more generic-component ceremony than it saves,
stop and leave `tags-panel.tsx` on its own bespoke table (partial
consolidation of 2 of 3 panels is still a real win, and forcing the third in
is not the goal).

**Verification**: all three settings panels (`/settings` tabs) behave
identically to before — search, add, rename, delete, and (tags only) bulk
actions. `npm run typecheck && npm run lint`.

## Final verification

After all phases: `npm run typecheck && npm run lint` clean, `git log`
shows one commit per phase, `docs/code-map.md` updated for any
added/moved/renamed files (Phase 4's new folder, Phase 5/6's new shared
components), `docs/progress.md` gets a row for this initiative referencing
spec 17 and this plan.
