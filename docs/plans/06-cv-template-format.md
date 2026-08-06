# CV Template Format — implementation plan

## Context

[Spec 05](../specs/05-cv-template-format.md) turns the four hardcoded template
components under `src/components/cv/templates/` into `TemplateDefinition` JSON,
rendered by one generic `TemplateNodeRenderer` instead of four `.tsx` files. It builds
on [spec 03](../specs/03-cv-selection.md)'s existing seam — "templates never read
these tables… one builder resolves a CV into a flat, ordered `ResumeDocument`" — and
does not touch it: content resolution stays exactly where it is, only the layer that
turns `ResumeDocument` into pixels changes shape.

**The design is fully settled in spec 05 already** — every open question (literal
text vs bind, whether a code-level escape hatch is needed, the extra `TemplateContext`
fields, the empty-propagation rendering rule, link support) was resolved by dry-running
the four real templates' hardest fragments against the node set on paper *before* this
plan was written, and the spec's "Open points" section records the reasoning for each.
This plan is pure execution against that already-closed design — no phase below makes
a new design call; if one turns out to be needed, that's a stop-and-amend-the-spec
moment, not something to improvise mid-phase.

## Allowed APIs (Phase 0 discovery)

Read directly, in full: `src/components/cv/templates/primitives.tsx`, `classic.tsx`,
`sidebar.tsx`, `compact.tsx`, `academic.tsx`, `contact-line.tsx`, `index.tsx`,
`src/lib/cv-templates.ts`, `src/components/cv/resume-render.tsx`,
`template-card.tsx`, `template-view-dialog.tsx`, `src/mocks/cv.ts` (types +
`buildResumeDocument`/`toEntry`), `src/index.css:130-161`, `docs/specs/
03-cv-selection.md` (Template binding + "What a template receives" sections),
`docs/specs/05-cv-template-format.md` (whole document, including the closed Open
points — treat that section as the design record, not just history), `package.json`.

**Confirmed facts that shape the phases below:**

- **Exactly two call sites reference a template's rendering code**:
  `src/lib/cv-templates.ts:37-85` (`cvTemplates` array, each entry's `component`
  field) and `src/components/cv/templates/index.tsx:19-29` (`TemplateRender` picks
  `.component` off the found/fallback entry and renders it). `ResumeRender`
  (`resume-render.tsx`), `TemplateCard`, `TemplateViewDialog`, and
  `src/pages/templates.tsx` all go through `templateId`/`document` only — none
  imports a template component. This is the whole blast radius outside the
  templates directory itself.
- **`ResumePage`** (`primitives.tsx:19-38`) carries `data-resume-page` — the print CSS
  selector `src/index.css:158-160` targets it (`box-shadow: none !important` under
  `@media print`). Whatever wraps a rendered `TemplateDefinition` must keep emitting
  this attribute, or print output regresses silently (no typecheck/lint would catch
  it — must be checked by hand, see Phase 6).
- **`@page { size: A4; margin: 0 }`** (`index.css:140-143`) and the
  `body:has([data-print-root]) > *:not(:has([data-print-root]))` rule
  (`index.css:154-156`) are page *chrome*, not template content — spec 05 already
  scopes `TemplateDefinition.root` to the page interior only; this confirms nothing
  in `src/index.css` needs to change.
- **No `zod` in `package.json`.** Spec 05 settles on it for runtime validation; Phase 1
  adds it as a new dependency — flagged explicitly here, not silently introduced,
  since CLAUDE.md's "use whatever package manager `package.json` declares" governs
  *how* to install, not *whether* a new dependency is warranted.
- **`document.location` is not part of `document.contact`** (`mocks/cv.ts:223-229`)
  but `contact-line.tsx:11-17` interleaves it into the same flat `parts` array
  alongside email/phone/url/socials — `contactParts` (spec 05's precomputed field)
  must do the same, in the same order, or Classic/Compact/Academic's header renders
  fields in the wrong order.
- **`entry.skills`** (`ResumeEntry.skills`, `mocks/cv.ts:207`) is never read by
  `EntryBlock` (`primitives.tsx:98-162`) in any of the four templates today. Nothing
  in this plan needs to bind it. Left as-is on `ResumeDocument`; not part of
  `TemplateContext`'s new fields.
- **No template renders a clickable link today** — `ContactLine` and `EntryBlock` both
  display URLs (`contact.url`, `entry.url`) as inert text, protocol stripped. Spec 05's
  `TextNode.href` adds the *capability*; Phase 4 (porting the four real templates)
  deliberately does **not** retrofit it into them — see Phase 4's note.

## Phase 1 — Types and runtime schema

New file `src/lib/cv-template-schema.ts`:
- The TypeScript types exactly as spec 05 defines them: `Style`, `BoxTag`,
  `TemplateNode` (`BoxNode | TextNode | JoinNode | RepeatNode | IfNode | RefNode` —
  note `TextNode` is `{ type: "text"; style?: Style; href?: string } & ({ bind:
  string } | { literal: string })`), `TemplateDefinition`. **No new `TemplateContext`
  type is defined here** — the renderer's `context` prop is typed as `ResumeDocument`
  (imported from `src/mocks/cv.ts`, extended in Phase 3), not a parallel type; spec 05
  names the concept, but the concrete type stays where `ResumeDocument` already lives.
- Add `zod` (`npm install zod`). Write `templateDefinitionSchema` as a
  `z.discriminatedUnion("type", [...])` mirroring the six-variant union, with
  `TextNode`'s `bind`/`literal` exclusivity enforced via `.refine()` (reject both set,
  reject neither set). Export `parseTemplateDefinition(input: unknown):
  TemplateDefinition`, throwing with zod's `.issues` path on failure — this is what
  protects the renderer from a malformed hand-edited (or, later, DB-sourced)
  definition. Validation runs unconditionally at module load (Phase 4), not gated
  behind a dev-only check — four small objects, parsed once at import, costs nothing
  worth branching on.

**Verification**: a scratch script feeding deliberately-broken objects through
`parseTemplateDefinition` — both `bind` and `literal` set on one `text` node; neither
set; an unknown `type`; a `repeat` missing `child` — confirming each throws naming the
actual problem field. `npm run typecheck` clean.

## Phase 2 — `TemplateNodeRenderer`

New file `src/components/cv/template-node-renderer.tsx`.

- `render(node: TemplateNode, scope: Record<string, unknown>, blocks:
  Record<string, TemplateNode>): React.ReactNode`, recursive, one case per `type`.
- **Scope resolution**: a bind path's first segment is looked up by name against the
  current scope object; `repeat`'s `as` and `ref`'s `with` extend the scope for their
  subtree as `{ ...scope, [as]: item }` (spec 05, "Binding and scope") — an outer
  `section` var stays reachable from a nested `entry` scope without extra plumbing.
- **Falsy rule** (spec 05): `null`/`undefined`/`""`/`[]` are falsy for `if`, for a bare
  `text`/`repeat` with an empty bound value, and for `TextNode.href` — one shared
  `isEmpty(value)` helper, not reimplemented per node type.
- **`text`**: resolve `bind` or `literal`; if the resolved string is empty, render
  `null`. If `href` is given and resolves non-empty, wrap in `<a href={resolved}>`;
  otherwise render the bare string.
- **Empty propagation**: `box` renders `null` when `children` was given and every
  rendered child comes back `null`/absent. Implemented by rendering children into an
  array, filtering, and returning `null` only if the filtered array is empty *and* the
  original `children` array was non-empty — a `box` with no `children` key at all still
  renders as a normal (if pointless) empty element.
- **`join`**: render each part, drop `null` results, intersperse `separator` between
  what's left, return `null` if nothing survived (feeds `box`'s empty propagation when
  a `join` is a box's only child).
- **`repeat`**: resolve `bind` to an array (empty/missing → `null`), apply `filter`
  then `sort` against the raw candidate item — *before* binding `as`, per spec 05 —
  map surviving items through `child` with scope extended by `as`, interleave
  `separator` between consecutive rendered items.
- **`ref`**: look up `block` in the enclosing `TemplateDefinition.blocks`, extend scope
  per `with` (each value a bind path resolved in the *caller's* scope, bound into the
  callee's scope under the target key), recurse. Throw a descriptive error on an
  unknown block name — a typo here fails loudly rather than silently rendering nothing.
  **Cycle guard**: thread a `Set<string>` of block names currently being expanded
  through the recursion; a `ref` whose target is already in that set throws instead of
  recursing forever. None of the four built-ins are recursive, so this never fires
  today — it exists because `blocks` is fully data-driven and spec 05's own "Out of
  scope" reasoning about untrusted custom templates (no `eval`, closed comparison
  surface) applies equally to an accidental or malicious block cycle, which would
  otherwise hang the renderer instead of failing loudly.
- The top-level export wraps `root` in the same `data-resume-page` element
  `ResumePage` uses (`primitives.tsx:19-38`) — the fixed 794×1123px A4 geometry and
  `print:` reset classes stay a plain component rather than data, per spec 05's "page
  chrome lives outside `TemplateDefinition`."

**Verification**: hand-written fixture nodes exercising every node type, including one
`text` with `href` (proving the link capability works even though the four real
templates won't use it yet) and one `box` wrapping a `join` that resolves empty
(proving the box disappears, not just the join). Render via a scratch component and
confirm the output shape by hand. Typecheck clean.

## Phase 3 — `TemplateContext`

Edit `src/mocks/cv.ts`. `buildResumeDocument` (`mocks/cv.ts:272-322`) and `toEntry`
(`mocks/cv.ts:324+`) gain the four precomputed fields spec 05 lists:

- `contactParts: string[]` on the document — port `contact-line.tsx:11-18`'s array
  construction verbatim (email, phone, `document.location`, url, then each social)
  into `buildResumeDocument`, replacing `ContactLine`'s inline computation. Keep
  `contact-line.tsx` itself alive for now (nothing is wired to the new renderer until
  Phase 5) — removed in Phase 7.
- Per entry, in `toEntry`: `kind` (the section's `ItemKind` — `toEntry` is already
  called from inside `buildResumeDocument`'s per-section `.map`, which has `row.kind`
  in scope at the call site, `mocks/cv.ts:301`), `dateRangeText` (port
  `formatEntryDates()` + `SINGLE_DATE_KINDS`, `primitives.tsx:41-61`, verbatim), and
  `keywords` (port `entry.lineGroups.find(g => g.kind === "keywords")?.items ?? []`
  from `primitives.tsx:106`).
- Extend the `ResumeEntry`/`ResumeSection` types (`mocks/cv.ts:190-214`) additively —
  nothing existing removed, so the four `.tsx` templates (not deleted until Phase 7)
  keep compiling unchanged against the same types throughout this phase.

**Verification**: typecheck; a scratch check that `buildResumeDocument()` for an
existing mock CV produces a `contactParts` array matching what `ContactLine` renders
today for the same document, spot-checked by eye against the current `/cvs/:id/print`
page before touching any template file.

## Phase 4 — Author the four `TemplateDefinition`s

**Shared blocks, authored once.** New file `src/lib/cv-template-blocks.ts` — a plain TS
object (`sharedBlocks: Record<string, TemplateNode>`) holding `sectionHeading`,
`bulletList`, `entryBlock`, `section`, ported from `primitives.tsx`'s
`SectionHeading`/`BulletList`/`EntryBlock`/`Section`. This is spec 05's "Modularity"
mechanism made real — each `TemplateDefinition` below gets `blocks: { ...sharedBlocks,
...ownBlocks }` (`ownBlocks` empty for Classic/Compact/Academic; Sidebar adds one own
block for its aside's contact list — distinct from `sharedBlocks.section`, which
Sidebar reuses unchanged for both its rail and main columns), so **every
exported/stored definition stays fully self-contained JSON** — `sharedBlocks` is an
authoring convenience, not a runtime dependency.

**`entryBlock`**, specifically — the trickiest port, so spelled out:
- `if bind="entry.kind" equals="skill"` → title + (if `entry.subtitle`) `" · "` +
  subtitle + (if `entry.keywords` non-empty) a literal `" — "` prefix followed by
  `repeat bind="entry.keywords" as="k" separator={text literal=", "}` — the em dash is
  easy to drop porting by eye; it's real (`primitives.tsx:106-117`, the `<span
  className="text-neutral-600"> — {keywords.join(", ")}</span>` wrapper).
- `else if bind="entry.kind" in=["language","interest"]` → title + subtitle only
  (`primitives.tsx:120-129`).
- `else` (generic) → title + `dateRangeText`, then `entry.summary` if present, then a
  `repeat bind="entry.lineGroups" as="group"` refing `bulletList` for every remaining
  line group (`primitives.tsx:157-159`). Between title and summary sits the trickiest
  fragment, `primitives.tsx:146-151` — confirmed by re-reading the source directly
  (`asText(entry.details.studyType)`/`asText(entry.details.score)`, lines 132-133):
  a `box` whose **two children, in order**, are (1) a `join` of `[{bind:
  "entry.subtitle"}, {bind: "entry.details.studyType"}]` separated by `" · "`, and
  (2) an `if bind="entry.details.score"` rendering the parenthetical — **as a second
  child of the same box, not a sibling box**, matching the original markup exactly
  (`score` is a `<span>` *inside* the same `<p>`, not a separate element). Empty
  propagation makes the whole box vanish when the `join` yields nothing, per the rule
  above. **Known, deliberate edge case**: the original ternary
  (`primitives.tsx:146`) gates the *entire* line's visibility on `subtitle ||
  studyType` only — `score` alone never triggers it. Decomposed into empty
  propagation, a `box` with an empty `join` but a *present* `score` no longer
  vanishes (the `if bind="entry.details.score"` child still renders), so an entry
  with a score but no subtitle/studyType would show `(score)` alone where the
  original showed nothing. Accepted rather than solved: that data state (a score
  with no institution or degree name) is close to invalid for an education entry,
  and closing the gap structurally would mean adding an "OR of two binds" capability
  to `if` for one edge case. If Phase 6's visual-parity check surfaces this
  combination in the mock CVs, revisit — don't let it pass silently.

**Not using `TextNode.href` in any of the four**: even though `entry.url`/contact URLs
exist in the data, none of today's four templates render them as links — adding
anchors now would be a real (if arguably positive) visual change, and Phase 6's
pixel-parity check needs a clean baseline. The capability is proven by Phase 2's
fixture instead. Turning a template's URLs into real links is a trivial follow-up
once this plan ships, not part of it.

**Four definitions**, one file each under `src/lib/cv-template-defs/` (`classic.ts`,
`sidebar.ts`, `compact.ts`, `academic.ts`), each exporting a `TemplateDefinition`
object, run through Phase 1's `parseTemplateDefinition` at module load (unconditionally,
per Phase 1) so a typo fails at import time, not at first render:

- **`classic.ts`**: port `classic.tsx:10-31` — centered header, `contactParts` repeat
  with a `{type: "text", literal: "·"}` separator, summary, one `repeat` over
  `sections` refing the shared `section` block. This is spec 05's worked example made
  real, verbatim.
- **`compact.ts`**: port `compact.tsx:9-30` — two-column header (`flex-wrap
  justify-between`), same `contactParts` repeat justified end, tighter spacing/type
  scale carried over as literal `Style` numbers (`text-[11px]` → `fontSize: 11`).
- **`academic.ts`**: port `academic.tsx:20-45` — wider padding; a `sort` on the
  `sections` repeat (`{field: "kind", priority: ["education", "publication", "award",
  "certificate"]}`) instead of the CV's own section order.
- **`sidebar.ts`**: port `sidebar.tsx:20-63` — root splits into two `box`es (`aside` +
  main `div`, `flex`); `aside` gets its own local contact block (`contactParts`
  repeat, **no** separator, one line per item — the stacked layout `contact-line.tsx`
  never uses) plus `repeat filter={field: "kind", op: "in", value: ["skill",
  "language", "interest", "certificate"]}` (`sidebar.tsx:7-12`'s `RAIL_KINDS`, inlined
  since that symbol won't exist post-Phase-7) refing `sharedBlocks.section`; main
  column gets the same filter with `op: "not-in"`.

Every literal style value (colors, padding, font sizes, letter-spacing) is copied from
the corresponding Tailwind class in the source `.tsx` file, not approximated —
`text-neutral-600` → `color: "#525252"`, `tracking-[0.12em]` → `letterSpacing:
"0.12em"`, etc. A short comment table (neutral-100 through neutral-900 — the only
palette these four templates use) goes at the top of `cv-template-blocks.ts` for
reference during porting, not as a runtime lookup, per spec 05's "self-contained,
literal values" rule.

**Verification**: typecheck; each of the four modules parses cleanly through
`parseTemplateDefinition` at import. No rendering yet — `cvTemplates` isn't wired to
these until Phase 5.

## Phase 5 — Swap the two call sites

- `src/lib/cv-templates.ts:20-35`: `CvTemplate.component: TemplateComponent` becomes
  `CvTemplate.definition: TemplateDefinition`. Delete the `TemplateComponent` type.
- `src/lib/cv-templates.ts:37-85`: each of the four entries' `component: XTemplate`
  becomes `definition: xTemplateDefinition` (imported from Phase 4's files). Every
  other field (`id`, `name`, `description`, `pageSize`, `density`, `atsSafe`,
  `bestFor`) stays exactly as-is — spec 05 kept these deliberately unchanged.
- `src/components/cv/templates/index.tsx:19-29`: `TemplateRender` renders
  `<TemplateNodeRenderer definition={template.definition} context={document} />`
  instead of `<template.component document={document} />` — Phase 3 already made
  `ResumeDocument` *is* `TemplateContext`, so no separate builder call is needed. The
  unknown-id → first-template fallback logic (`index.tsx:24-26`) is untouched.

**Verification**: typecheck, lint (both required by CLAUDE.md before calling any phase
done). `git diff --stat -- src/components/cv/resume-render.tsx
src/components/cv/template-card.tsx src/components/cv/template-view-dialog.tsx
src/pages/templates.tsx` returns empty — the concrete check for "everything
downstream already goes through `templateId`," not just an assertion.

## Phase 6 — Visual-parity verification

Per CLAUDE.md's UI verification rule (one desktop screenshot + console-error check, no
viewport/theme sweep). For **each of the four templates**:

1. Screenshot `/templates` (the gallery, `TemplateCard` thumbnails) and
   `/cvs/:id/print` (or the template view dialog) *before* Phase 5's swap — captured
   once, right after Phase 4, before touching the call sites. This is the baseline.
2. Re-screenshot the same views *after* Phase 5.
3. Compare side by side for each template: header layout, section spacing, rail/main
   split (Sidebar), section order (Academic), contact line separators, the education
   entry's subtitle/studyType/score line (the empty-propagation rule's one real test
   case). Flag anything beyond sub-pixel font-rendering noise.
4. Check the browser console for errors on each of the four `/templates` gallery cards
   and one full-size preview per template.
5. Confirm print output specifically: `data-resume-page` still present on the rendered
   root (inspect the DOM, not just the screenshot — this is the one regression a visual
   screenshot alone wouldn't catch, per Phase 0's finding on the print CSS selector).
6. Any real difference found here is a gap the spec's design work didn't anticipate —
   fix it by amending spec 05 (a new rule or field, same discipline the spec's existing
   "Open points" resolutions used) and the specific `TemplateDefinition`, not by
   special-casing the renderer for one template.

**This phase is the actual acceptance criterion for the whole plan** — the JSON format
isn't done until it's proven to reproduce today's four templates pixel-for-pixel
(modulo font antialiasing).

## Phase 7 — Cleanup

Only after Phase 6 passes clean:

- Delete `src/components/cv/templates/{classic,sidebar,compact,academic}.tsx`,
  `primitives.tsx`, `contact-line.tsx`.
- Grep the repo for any remaining import of these six files — zero hits expected
  outside `cv-template-blocks.ts`'s porting comments (which reference file:line by
  name, not by `import`).
- `npm run typecheck && npm run lint && npm run build` clean.
- Update `docs/progress.md` row 14: status → "Done", note the final file layout
  (`cv-template-schema.ts`, `template-node-renderer.tsx`, `cv-template-blocks.ts`,
  `cv-template-defs/*.ts`) and that the four `.tsx` templates are gone.

## Final verification

1. Re-read spec 05 top to bottom against the shipped code — every `TemplateNode`
   field, every `TemplateContext` addition, the empty-propagation rule, matches what
   was actually built. Fix drift in the spec, not by leaving it stale (CLAUDE.md:
   specs/plans should not drift from reality).
2. Grep for `TemplateComponent` and `.component` on a `CvTemplate` — zero hits.
3. `npm run typecheck`, `npm run lint`, `npm run build` — all clean.
4. Re-run Phase 6's full screenshot set once more against the final (post-cleanup)
   build, not just the pre-cleanup one — deleting the old files shouldn't change
   output (nothing after Phase 5 references them), but this is the cheap way to be
   sure.
5. `docs/progress.md` row 14 reflects reality.

## Reused, not rebuilt

- `ResumeDocument`/`buildResumeDocument` (spec 03) — extended, not replaced.
- `ResumePage`'s A4 geometry and `data-resume-page` print hook — kept as the fixed
  page-chrome wrapper `TemplateNodeRenderer`'s top-level export uses.
- `cvTemplates` as the single source of truth for template metadata and the
  unknown-id fallback (`index.tsx:19-29`) — only the `component`/`definition` field
  changes shape.
- `ResumeRender`, `TemplateCard`, `TemplateViewDialog`, `pages/templates.tsx` — zero
  changes, confirmed in Phase 5.

## Out of scope

Per spec 05's own "Out of scope" section, unchanged by this plan:
- A visual/WYSIWYG template editor.
- Any user-facing custom-template creation/import/export flow.
- The `cv_templates` Supabase table and its RLS policy.
- An expression language or `eval` — the comparison surface stays `filter`/`sort`/
  `if equals`/`if in`, nothing else, even if porting tempts adding one for
  convenience.
- Changing where a CV's template choice lives (spec 03's preview-only binding is
  untouched — this plan never edits `cvs`/`cv_sections`/`cv_items`/`cv_lines`).
- Wiring `TextNode.href` into the four real templates' URLs (see Phase 4) — the
  capability ships, using it on the built-ins doesn't.
