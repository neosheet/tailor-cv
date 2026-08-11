# 10 — CV Template Format v2: JSON-UI Structure + Real PDF Output

**Archival note (`native-print` branch):** the PDF backend this plan builds
(`template-pdf-renderer.tsx`, `@react-pdf/renderer`) was executed as written, then later
confirmed dead code and deleted outright once `cv-print.tsx` switched to native
`window.print()` — see [specs/07](../specs/07-cv-template-pdf-format.md)'s amendment
note and `docs/progress.md`. Kept here as the historical record of that phase's
execution, same as spec 05 is kept relative to spec 07.

Implements [specs/07-cv-template-pdf-format.md](../specs/07-cv-template-pdf-format.md)
(supersedes [specs/05](../specs/05-cv-template-format.md) and its plan,
[plans/06](06-cv-template-format.md), which was never executed). Replaces the current
six-node closed-set `TemplateNode` format (inline-only `Style`, pixel units, no page
config) with the `json-ui`-shaped format (named `styles` registry with `extends`,
`blocks` registry addressed via `$prop`/`$item`/`$index`/`$data` sigils, point units,
`page: PageConfig`), and adds a real `@react-pdf/renderer` PDF backend alongside a
rewritten DOM preview backend. Only the Classic template exists today — it's the only
one ported.

## Doc discovery (Phase 0)

**Current implementation** (`src/lib/cv-template-schema.ts`, all read in full):
- `TemplateNode` today is a 6-variant union keyed by a `type: "box"|"text"|"join"|"repeat"|"if"|"ref"`
  string literal (`cv-template-schema.ts:11-104`). Validated by a plain `z.union` (not
  `discriminatedUnion` — a `.refine()` on `textNodeSchema` drops discriminant metadata,
  per the comment at `cv-template-schema.ts:129-136`).
- `TemplateDefinition` today: `{schemaVersion: 1, id, name, description, pageSize,
  density, atsSafe, bestFor, blocks: Record<string, TemplateNode>, root}` — no `page`,
  no `styles` registry, no `settings` (`cv-template-schema.ts:92-104`).
- `Style` is `Record<string, string|number>`, values are **pixels** (spec 05 model),
  e.g. `fontSize: 24` = 24px.
- `template-node-renderer.tsx` dispatches via a `switch(node.type)` (`:53-67`). `Scope`
  is a flat `Record<string, unknown>` name-based bag, root scope = `ResumeDocument` cast
  directly (`:296-301`) — not a `$data`/`$prop`/`$item` sigil system. `renderRepeat`
  spreads parent scope + one new key per item (`:192`); `renderRef` resolves `with`
  paths against the caller's scope into the block's scope (`:260-265`), with an
  `expanding: Set<string>` cycle guard (`:250-258`, throws on cycle or unknown block).
  Empty propagation lives in `renderBox` (`:76-96`, collapses to `null` if every
  resolved child is null/undefined) — carries forward unchanged per spec 07.
  `TemplateNodeRenderer` hardcodes the A4 page wrapper itself:
  `min-h-[1123px] w-[794px]` at 96dpi pixels (`:296-301`) — page chrome is
  renderer-owned today, not `TemplateDefinition`-owned.
- `ResumeDocument`/`ResumeEntry`/`ResumeSection` (`src/lib/persona.ts:108-157`) already
  carry every field spec 07's `TemplateContext` needs (`contactParts`, `entries[].kind`,
  `.dateRangeText`, `.keywords`) — **this plan touches none of that**, content
  resolution is untouched, confirmed unchanged from spec 03/05. `entry.skills` exists on
  the type but nothing currently binds to it (dead field, not this plan's problem).
- Call sites and exact props (grep-confirmed complete): `templates/index.tsx:19-33`
  (`TemplateRender`, no scale), `resume-render.tsx:17-50` (`ResumeRender`, the **only**
  place `scale` exists — natural size via `w-[794px] h-[1123px]` transformed by CSS
  `scale-[var(--resume-scale)]` when `scale !== 1`, matching `SidebarProvider`'s
  `--sidebar-width` custom-property pattern), `template-card.tsx:44-50` (`scale={0.26}`
  thumbnail), `template-view-dialog.tsx:49-55` (`scale={0.82}` dialog preview),
  `cv-print.tsx:91` (no scale → natural size).
- `cv-print.tsx` confirmed exactly as spec 07 describes: a `print:hidden` toolbar with a
  literal `<Button onClick={() => window.print()}>` (no PDF library imported anywhere in
  the CV rendering path) plus `<ResumeRender>` at natural scale inside a
  `data-print-root` div that `index.css`'s print media query keys off to hide chrome.
- Only `src/components/cv/templates/index.tsx` remains in `templates/` — the old
  `.tsx` per-template components spec 05 describes migrating away from are already gone;
  there is nothing to delete at the end of this plan beyond the schema/renderer files
  this plan itself replaces.
- Current deps (`package.json`): `zod: ^4.4.3` present (spec 05's "new dependency" open
  point already resolved). `@react-pdf/renderer` **absent** — zero PDF groundwork exists.
  React `^19.2.6`, Vite `^8`, TypeScript `~6`, react-router `^8` (single package, not
  `-dom`).
- `npm view @react-pdf/renderer` confirms `4.5.1`'s `peerDependencies.react` is
  `^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0` — compatible with this repo's React 19,
  no downgrade needed.

**Reference (`/Users/Shared/json-ui-react/src/jsonui/`, all read in full)**:
- `core.js:33-53` — canonical `resolveValue(value, scope, data)`: only whole-string
  values starting with `$` are placeholders (no interpolation into a larger string);
  first path segment after `$` picks the root (`prop`/`item`/`index`/`data`), the rest
  is a dot-path walked by `getPath`, returning `undefined` on any null/undefined
  intermediate rather than throwing. `$index` short-circuits straight to `scope.index`.
  Unrecognized roots return the literal string unchanged.
- `core.js:7-29` — canonical `resolveStyleObject(styles, styleDefs, inline)` /
  `flattenStyle`: precedence low→high is `extends` (recursive, array order,
  cycle-guarded via a `Set` shared across one call — a revisited name in the graph
  silently resolves to `{}`, not an error) → the style's own keys → each name in the
  node's `styles` array left→right → inline `style` last.
- `renderer.jsx:49-60` — DOM dispatch order is actually `null → array → string →
  number → repeat → block → tag → throw`. **No `if`/`join` branch exists in this
  reference** — spec 07 already scopes `IfNode`/`JoinNode` as CV-specific additions
  *not* present in json-ui (`docs/specs/07:188-212`), so this is a confirmation of
  spec 07's own framing, not a contradiction to resolve. `renderer.jsx` reimplements
  `resolveValue`/`resolveStyle` locally rather than importing `core.js` (functionally
  identical) — this plan's shared `cv-template-core.ts` should be the single real
  source both backends import, closer to how `renderPdf.js` already does it than how
  `renderer.jsx` does.
- `renderer.jsx:138-155` — style hoisting dedups by `JSON.stringify` of the sorted
  resolved-entries as a cache key, one `<style>` tag with sequential `s1`, `s2`, …
  classes, scoped to one `buildDocument` call. **Not adopted by this plan** — spec 07
  doesn't ask for CSS-class hoisting, and DOM backend consumers here (`TemplateCard`,
  `TemplateViewDialog`) already work fine with inline resolved styles; noted as a
  reference detail, not a requirement.
- `renderPdf.js:9,16-21` — imports `{ Document, Page, View, Text, Image, Font }` from
  `@react-pdf/renderer`, no `StyleSheet` (plain objects passed straight to `style`).
  `TEXT_TAGS`/`IMAGE_TAGS` are static tag-name sets; anything else structural falls to
  `View`.
- `renderPdf.js:42-45` — **load-bearing gotcha**: react-pdf's `lineHeight` multiplies
  against a Text node's *own* `fontSize` (defaulting to 18 if unset), so `fontSize`/
  `lineHeight` must be explicitly re-emitted on every `<Text>`, threaded down via an
  inherited-metrics param (`inh`) through the whole recursion — matches spec 07's
  "inherited, multiplies each node's own fontSize" line (`docs/specs/07:86-87`)
  precisely; this plan's PDF backend must do the same threading.
- `renderPdf.js:154-160` — `fixed`/`break`/`wrap` are a straight passthrough to
  react-pdf's own identically-named props (`fixed`/`break` only ever set `true`,
  `wrap` only ever set `false` to override react-pdf's own default `true`).
- `renderPdf.js:136-149` — page numbers use react-pdf's own
  `render={({pageNumber, totalPages}) => …}` callback on a `<Text>`, custom `{n}`/`{t}`
  token format string (default `"{n} / {t}"`, matches spec 07 exactly). Comment warns:
  a page-number `<Text render>` must **not** also get an explicit `lineHeight` —
  "can drop it from layout" (undocumented react-pdf quirk, empirically found).
- `renderPdf.js:12-14` — `Font.registerHyphenationCallback((word) => [word])`
  disables hyphenation so PDF word-wrap matches the browser preview; no
  `Font.register(...)` custom-font calls anywhere — relies entirely on react-pdf's
  built-in Helvetica/Times/Courier metrics, matching spec 07 open point 2's resolution
  (PDF-safe built-ins, not the app's own `Geist` web font).
- `renderPdf.js:162-172,24-29` — `cleanStyle()` strips a hardcoded unsupported-CSS-key
  set (`boxShadow`, `gridTemplateColumns/Rows/Areas`, `cursor`, `transition`,
  `boxSizing`, `appearance`, `listStyle`, `outline`, `whiteSpace`, `float`, `content`),
  renames `background`→`backgroundColor`, and converts `"Nmm"`/`"Npt"` string units.
  **Adopted narrower per spec 07**: since this plan's `Style` values are always numeric
  points already (no unit-suffixed strings — spec 07:99-108), the unit-string
  conversion branch is dead weight and skipped; the unsupported-key strip and
  `background`→`backgroundColor` rename are kept as defensive belt-and-suspenders
  (spec 07:313-314 already calls this out).
- `PdfPreview.jsx:1-29` — `<PDFViewer showToolbar style={{width:"100%",height:"100%",
  border:0}}>{element}</PDFViewer>` and `<PDFDownloadLink document={element}
  fileName={…}>{({loading}) => …}</PDFDownloadLink>`, both memoized on
  `[doc, size, orientation]`. `element` is a **built `<Document>` element**, not a
  factory function, passed directly. `<PDFViewer>`'s inline `style` prop is
  `@react-pdf/renderer`'s own web-component API surface, not app UI — the one place
  this plan's PDF preview page is allowed an inline style, everything else in the app
  stays Tailwind-only per `CLAUDE.md`.
- `renderPrintHtml.jsx` gotchas carried into this plan's DOM backend: pt→px scale
  `K = 96/72` applied to every numeric length except a fixed `UNITLESS` set
  (`fontWeight`, `lineHeight`, `opacity`, `zIndex`, `flexGrow`, `flexShrink`, `flex`,
  `order`, `aspectRatio`); react-pdf `View`s default to `flexDirection: column` (unlike
  a plain CSS block element) — the DOM backend must set that explicitly per structural
  node; font-family fallback chains must be hand-matched to react-pdf's base-14 metrics
  (Helvetica≈Helvetica/Arial/system-ui, **not** a variable web font — `Geist` is not
  used for resume text).
- `@react-pdf/renderer` pinned at `4.5.1` in the reference's own `package.json` —
  same version this plan installs (confirmed React-19-compatible above).

**Confidence**: high on all of the above — both research passes read every requested
file in full with verified file:line citations, cross-checked against a direct
`npm view` call for the peer-dependency question. Gaps noted by the research passes
(untouched `index.css` print rules, `mocks/types.ts` internals, a "Refresh" PDF button
UI not present in the requested reference files) are not load-bearing for this plan —
`index.css`'s print media query is read in Phase 4 when `cv-print.tsx` changes shape,
and the reference "Refresh" button doesn't apply here since this plan's `<PdfPreview>`
equivalent has no separate live-HTML/PDF toggle (see Phase 4 scope).

## Locked-in decisions

1. **A4 pt geometry already matches today's px hardcoding.** A4 = 595.28×841.89pt;
   at `K = 96/72` that's 793.7×1122.5px ≈ today's hardcoded `794×1123`. The DOM
   backend's page-size math isn't a guess — it reproduces exactly what's on screen
   today for the A4 default, just derived from `page.size`/`page.margin` instead of
   hardcoded.
2. **One shared `cv-template-core.ts`, imported for real by both backends** — not
   duplicated per backend the way `renderer.jsx` does it in the reference. Both
   `template-node-renderer.tsx` (DOM) and the new `template-pdf-renderer.tsx` (PDF)
   call the same `resolveValue`/`resolveStyleObject` exports.
3. **No CSS-class hoisting/dedup** in the DOM backend — inline resolved style objects
   only, matching the current renderer's approach and spec 07's own silence on hoisting.
4. **No unit-suffixed style strings** (`"12mm"`/`"10pt"`) — every numeric `Style` value
   is a bare point number per spec 07; `cleanStyle` doesn't need `renderPdf.js`'s string
   parsing branch.
5. **PDF page fonts**: `Helvetica` family only (react-pdf built-in), never `Geist` —
   resolves spec 07 open point 2.
6. **Classic only.** Sidebar/Compact/Academic stay unbuilt, matching spec 07's own
   explicit scope.
7. **No settings editor, no `cv_templates` table, no visual/WYSIWYG editor** — spec 07's
   "Out of scope" carries forward verbatim; `TemplateSettings` gets the type and the
   render-time plumbing (an optional prop, unused by every current caller), nothing
   that produces or persists a real value.

## Phase 1 — Dependency + shared core

- `npm install @react-pdf/renderer@^4.5.1`.
- New `src/lib/cv-template-core.ts`, framework-free (no React import), mirroring
  `core.js`'s two functions but adapted to spec 07's exact shapes:
  - `resolveValue(value: unknown, scope: TemplateScope, data: ResumeDocument): unknown`
    — implements the `$data`/`$prop`/`$item`/`$index` sigil rules from spec 07's
    "Scope and placeholders" table (`docs/specs/07:241-264`) exactly as `core.js:33-53`
    does it (whole-string match only, dot-path walk, undefined-safe).
  - `resolveStyleObject(styleNames: string|string[]|undefined, styleDefs:
    Record<string, StyleDef>, inline: Style|undefined, settingsStyles?:
    Record<string, Style>): Style` — implements spec 07's exact resolution order
    (`docs/specs/07:282-286`): flatten each name's `extends` chain (cycle-guarded per
    `core.js:7-29`'s `Set`-based guard) → shallow-merge `settingsStyles[name]` onto
    that name's flattened result → merge every referenced name left-to-right → merge
    the node's own inline `style` last.
  - `TemplateScope = { prop?: Record<string, unknown>; item?: unknown; index?: number }`
    — the sigil-scope type, replacing today's flat name-based `Scope`.

**Verification**: `npm run typecheck` clean (new file, zero consumers yet, so this
can't break anything else). No browser check needed — nothing renders through this
file yet.

## Phase 2 — Schema rewrite

Rewrite `src/lib/cv-template-schema.ts` in place to spec 07's exact types
(`docs/specs/07:51-235`, quoted in full there — copy the shapes verbatim, don't
reinvent field names):
- `TemplateDefinition`: `schemaVersion: 2`, `page: PageConfig`, `styles:
  Record<string, StyleDef>`, `blocks: Record<string, BlockDef>`, `root: TemplateNode`
  (drops `pageSize` — redundant with `page.size` per spec 07:329-331).
- `PageConfig`, `Style`/`StyleDef` (points, not pixels; `extends?: string[]` on
  `StyleDef` only).
- `TemplateNode` as the 6-shape structural union (`ElementNode`, `BlockInstanceNode`,
  `RepeatNode`, `IfNode`, `JoinNode`, `PageNumberNode`) distinguished by which key is
  present, **not** a `type` discriminant literal — keep the existing plain-`z.union`
  approach (not `discriminatedUnion`) since spec 07's shapes have the same
  discriminant-metadata problem the current `.refine()`-based `textNodeSchema` comment
  already documents (`cv-template-schema.ts:129-136`) — an `ElementNode` with only
  `text` and no `tag` is structurally close to other shapes, so validate with
  `.refine()`-based checks per node shape the same way, not a naive union.
  `BoxTag` gains `header`/`aside`/`section` (unchanged) and text-bearing tags
  `h1`/`h2`/`h3`/`a` (new — spec 07:139).
- `BlockDef = { props?: string[]; node: TemplateNode }` (replaces the current
  `blocks: Record<string, TemplateNode>` — now a props-documenting wrapper, not a bare
  node).
- `TemplateSettings` type (spec 07:268-279) — export it, no consumer wires it yet
  (locked-in decision 7).
- `parseTemplateDefinition` stays the runtime entry point, updated for the new zod
  schema; keep the "cast to `TemplateDefinition` after validation" pattern the current
  code already uses for the same discriminant-metadata reason.

**Anti-pattern guard**: don't add an `eval`/expression language for `if`/`filter`/
`sort` — spec 07 is explicit that `equals`/`in` string comparison is the entire
surface (docs/specs/07:341-347).

**Verification**: `npm run typecheck` will now show errors in every file still
importing the old shapes (`cv-template-blocks.ts`, `cv-template-defs/classic.ts`,
`template-node-renderer.tsx`, `cv-templates.ts`) — expected, fixed in Phases 3-4. Don't
treat a clean typecheck as the gate for this phase; treat "the new schema file itself
matches spec 07's quoted shapes field-for-field" as the gate, confirmed by a manual
diff against `docs/specs/07-cv-template-pdf-format.md:51-235`.

## Phase 3 — DOM backend + Classic definition rewrite

This phase must land together — `cv-template-blocks.ts`, `cv-template-defs/classic.ts`,
and `template-node-renderer.tsx` are mutually dependent on the new schema and on each
other, and nothing compiles again until all three move.

- **`src/components/cv/template-node-renderer.tsx`** — rewritten dispatch, structural
  (matching `renderer.jsx:49-60`'s shape-check order, extended per spec 07 for the two
  CV-specific node shapes it adds): check `pageNumber` → `repeat` → `block` → `if` →
  `join` → else treat as `ElementNode`. Uses `cv-template-core.ts`'s
  `resolveValue`/`resolveStyleObject` (no locally-duplicated copies — locked-in
  decision 2). `TemplateScope` threading: `renderRepeat` resolves `as` against
  `{item, index}` per spec 07's scope table (docs/specs/07:249-250), passes the result
  as the new `prop` scope into the block instance — `$item`/`$index` are **not**
  visible inside the instantiated block itself, only `$prop` is (this is a real
  behavior change from today's `renderRepeat`, which spreads the parent scope so
  ancestor names stay reachable — spec 07 deliberately drops that in favor of explicit
  `props`, docs/specs/07:253-259). Page wrapper becomes dynamic: reads
  `definition.page.size`/`.margin`/`.fontFamily`/`.fontSize`/`.lineHeight`/`.color`
  (defaults per spec 07:81-92) instead of the hardcoded `794×1123` div, scaling every
  resolved `Style` value by `K = 96/72` per the `UNITLESS` exception set from
  `renderPrintHtml.jsx` (locked-in decision's carried gotcha) — `fontWeight`,
  `lineHeight`, `opacity`, `flex*`, `zIndex`, `order`, `aspectRatio` pass through
  unscaled, string values pass through unscaled. `header`/`footer` render once each
  (DOM backend doesn't paginate) per spec 07:88-89. `fixed`/`break` are no-ops beyond
  an optional visual divider for `break` (spec 07:153-157) — don't build real
  pagination into the DOM backend.
- **`src/lib/cv-template-blocks.ts`** — every block ported to the new `BlockDef` shape
  (`props` list + `node`), rewritten to use `$prop.*`/`$item.*` sigils instead of named
  scope variables. Per spec 07's own audit (docs/specs/07:255-259), no existing block
  needs two ancestor-named variables live at once, so this is a mechanical rename, not
  a redesign — confirm that claim while porting (if a block genuinely needs it, that's
  a real problem to flag, not silently work around).
- **`src/lib/cv-template-defs/classic.ts`** — rewritten with a real `styles` registry
  (named fragments for repeated fragments — section heading, entry title, muted text,
  etc., replacing inline `style` objects wherever the same visual treatment repeats
  more than once, consistent with `CLAUDE.md`'s "second occurrence is the signal to
  extract" rule applied to the JSON format itself), `page` block carrying Classic's
  margin/font defaults, all values converted from today's pixel numbers to points
  (divide by `K = 96/72`, i.e. multiply by `72/96 = 0.75`).
- **`src/lib/cv-templates.ts`** — `CvTemplate` drops `pageSize` (now read from
  `definition.page.size`); every reader of `CvTemplate.pageSize` updated.

**Verification**: `npm run typecheck && npm run lint` clean — this is the point where
the whole chain compiles again. Then a **live browser check** (per `CLAUDE.md`'s UI
verification rule): navigate to a Persona's CV page, open the Templates tab, screenshot
the Classic thumbnail (`TemplateCard`) and the full preview (`TemplateViewDialog`) —
confirm the layout is visually equivalent to before this plan (same content, same
approximate proportions — pixel-identical isn't the bar here, "did the format
conversion preserve the design" is). Check browser console for errors. `cv-print.tsx`
is untouched in this phase and should still render fine through the same
`ResumeRender`→`TemplateRender`→`TemplateNodeRenderer` chain, natural-scale.

## Phase 4 — PDF backend

- New `src/components/cv/template-pdf-renderer.tsx`, mirroring `renderPdf.js`'s shape
  but importing `resolveValue`/`resolveStyleObject` from `cv-template-core.ts` (not a
  local copy):
  - `import { Document, Page, View, Text, Image, Font } from "@react-pdf/renderer"`
    (no `StyleSheet` — plain resolved objects to `style`, matching `renderPdf.js:9`).
  - `Font.registerHyphenationCallback((word) => [word])` at module scope, once
    (matches `renderPdf.js:12-14`'s rationale — PDF word-wrap should match the DOM
    preview, no mid-word hyphen breaks on either backend).
  - `TEXT_TAGS`/`IMAGE_TAGS` static sets per spec 07's `BoxTag` split
    (docs/specs/07:137-139): text-bearing tags (`span`,`p`,`h1`,`h2`,`h3`,`a`,`li`) →
    `Text`; everything else structural (`div`,`header`,`aside`,`section`,`ul`) → `View`
    — no `img`/`image` tag exists in spec 07's `BoxTag` union today, so the
    `IMAGE_TAGS` branch has nothing to map yet; keep the branch present but unreachable
    rather than adding an unrequested image capability.
  - `cleanStyle()`: strip the same unsupported-CSS-key set `renderPdf.js:24-28` does
    (`boxShadow`, `gridTemplateColumns/Rows/Areas`, `cursor`, `transition`,
    `boxSizing`, `appearance`, `listStyle`, `outline`, `whiteSpace`, `float`,
    `content`), rename `background`→`backgroundColor`. **No unit-string parsing
    branch** (locked-in decision 4 — values are already bare point numbers).
  - `fontSize`/`lineHeight` inheritance threading: an `inh: {fontSize, lineHeight}`
    param passed through the whole recursion (starting from `page.fontSize`/
    `page.lineHeight` defaults), explicitly re-emitted on every `<Text>`'s resolved
    style object — copy `renderPdf.js:42-45`'s exact rationale (react-pdf's
    `lineHeight` multiplies against a Text's own `fontSize`, defaulting to 18
    otherwise).
  - `fixed`/`break`/`wrap` straight passthrough to react-pdf's own props, matching
    `renderPdf.js:154-160`'s `layoutFlags()`.
  - `PageNumberNode` → a `<Text render={({pageNumber, totalPages}) => fmt.replace(...)}
    >`, format default `"{n} / {t}"` per spec 07:217-219; explicit `fontSize` on its
    style, **no `lineHeight`** on that specific Text (matches `renderPdf.js:136-149`'s
    documented "can drop it from layout" quirk).
  - `page.header`/`page.footer` → wrapped with `fixed: true` so they repeat on every
    PDF page (spec 07:88-89's PDF-backend behavior, contrasted with the DOM backend's
    once-only render from Phase 3).
  - Top-level `buildPdfDocument(definition: TemplateDefinition, document: ResumeDocument,
    settings?: TemplateSettings): ReactElement` — builds the `<Document><Page
    size={...} orientation={...}>...</Page></Document>` tree, applying
    `settings.nodes[id].hidden` visibility checks before style work (spec 07:286,
    same rule as the DOM backend).
- **`src/pages/cv-print.tsx`** rewritten: read `src/index.css`'s print media rules
  first to confirm what `data-print-root` currently does, then remove the
  `window.print()` button and `data-print-root`/print-CSS machinery entirely (a real
  PDF download replaces the browser print dialog — no more reason to special-case
  print media on this page). Replace with:
  - `<PDFViewer>` (from `@react-pdf/renderer`) wrapping
    `buildPdfDocument(template.definition, document)`, sized to fill the available
    content area — matches `PdfPreview.jsx:1-16`'s pattern, `showToolbar` prop kept
    (react-pdf's own in-viewer toolbar gives zoom/page nav for free).
  - A `<PDFDownloadLink document={buildPdfDocument(...)} fileName={...}>` replacing
    today's "Print" button, `{personaName} — {template.name}.pdf` per spec 07 open
    point 3's suggested resolution, render-prop showing "Preparing…" while `loading`.
  - Memoize the built `<Document>` element on `[document, template]` (matches
    `PdfPreview.jsx:8,20`'s memoization, avoids rebuilding on every render).
  - Keep the existing "Back to CVs" link and empty-state handling
    (`cv-print.tsx:28-56`ish) unchanged — this phase only touches the toolbar/preview
    body, not the not-found path.

**Anti-pattern guards**: don't add `Font.register(...)` custom font files — Helvetica
built-in only (locked-in decision 5). Don't build hand-rolled pagination/orphan-widow
logic — react-pdf's own layout engine paginates (spec 07:355-358, "Out of scope").

**Verification**: `npm run typecheck && npm run lint` clean. Live browser check:
navigate to `/cvs/:id/print` for a real seeded CV, confirm the `<PDFViewer>` actually
renders a PDF (not a blank/error frame), click Download and confirm a real `.pdf` file
downloads with the expected filename, open the downloaded file and spot-check that text
is selectable (confirms real text layer, not a rasterized image — matches spec 07's
"actual PDF" framing, docs/specs/07:27-33). Check browser console for errors
(react-pdf sometimes logs layout warnings — note but don't treat as blocking unless
they indicate a real rendering defect).

## Phase 5 — Pixel-parity check + cleanup

- Screenshot the DOM preview (`TemplateViewDialog` on `/cvs` → Templates tab) and the
  PDF preview (`/cvs/:id/print`) for the same underlying `ResumeDocument`+Classic
  template pairing, side by side. This is spec 07's own stated acceptance bar
  (docs/specs/07:376-378: "pixel-parity screenshots per template before deleting any
  `.tsx` file") — there's no `.tsx` file to delete this time (already JSON-driven
  before this plan started), so this step is pure visual QA: confirm the two backends
  agree on layout, font sizing, spacing, and page proportions closely enough that the
  DOM view is a trustworthy approximation of the real PDF, per spec 07's framing.
- Full `npm run typecheck && npm run lint && npm run build` clean.
- Update `docs/progress.md` row 14: status → "Done", plan link → this file, note
  summarizing what shipped (new dependency, two-backend split, Classic-only scope,
  settings plumbing present but unwired).

## Out of scope (carried from spec 07 verbatim)

Visual/WYSIWYG template editor, custom-template creation/import/export flow,
`cv_templates` Supabase table + RLS, an expression language/`eval`, a settings *editor*
UI or wiring `TemplateSettings` into a saved `cvs` row, hand-rolled pagination beyond
`fixed`/`break`/`wrap`, porting Sidebar/Compact/Academic templates.

## Open items carried forward

1. `schemaVersion` migration story — still unanswered, fine while nothing is stored in
   Supabase (spec 07 open point 1).
2. Whether per-node `settings` ever gets a real editor UI and a place to persist a
   value — noted as future work, not built here (spec 07 open point new-to-this-spec).
3. `entry.skills` stays unbound in every current block (pre-existing, not introduced or
   fixed by this plan).
