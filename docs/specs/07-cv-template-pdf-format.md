# 07 — CV Template Format v2: JSON-UI structure

**Supersedes [05 — CV Template Format](05-cv-template-format.md).** Spec 05's six-node
closed set (`box`/`text`/`join`/`repeat`/`if`/`ref`), inline-only `Style`, and
"page chrome lives outside `TemplateDefinition`" rule are all replaced below. Spec 05
stays in the repo as the design record for *why* those choices were made the first
time — several of its reasoning (empty propagation, name-based scope, no `eval`) still
holds and is carried forward, just expressed differently.

Builds on [03 — CV Selection](03-cv-selection.md), unchanged: **templates never own
content.** They still receive an already-resolved `ResumeDocument` and decide only how
to arrange and style it.

**Amended on the `native-print` branch:** this spec originally also introduced a second,
real-PDF rendering backend (`@react-pdf/renderer`), described below in earlier revisions.
That backend was built, never wired up as the primary print path, confirmed dead code by
Batch 1 (`docs/progress.md` row 19), and has now been deleted outright — `cv-print.tsx`
prints via the browser's native `window.print()` (`react-to-print`) over the DOM
renderer, and that's the only rendering path this format needs to support. Everything
below describes the format as it stands with **one backend**; the point-based unit
system and restricted style vocabulary are kept as-is (they're just a units/vocabulary
choice now, not required for parity with a second backend).

## Why this reopens a "fully settled" spec

Spec 05 shipped one template ("Classic") against a schema modeled as a closed set of
CV-specific node types with inline-only styling and a fixed, code-owned page wrapper.
A concrete reference format (`json-ui`, reviewed directly) showed a cleaner split
between *arrangement* (`tag`/`attrs`/`children`), *reusable style* (a named `styles`
registry with `extends`), and *reusable structure* (`blocks` instantiated with
explicit `props`, addressed by `$prop.`/`$item.`/`$data.` placeholders instead of
free-form named scope variables). That split is exactly what's needed to let a later
settings layer target *a style* or *a node* by name instead of only by editing JSON
in place.

## The idea, restated

```
ResumeDocument  →  TemplateContext          (content — unchanged from spec 03/05)
                          │
TemplateDefinition (JSON) │  →  shared core (scope + style resolution)
                          ↓            │
              (arrangement, named          └─→  DOM renderer   → React tree (native print)
               styles, page geometry)
```

One JSON document, one renderer, sharing a resolution core — mirroring `json-ui`'s
`core.js` / `renderer.jsx` split (minus its PDF-specific leaf). Content resolution
(`ResumeDocument`) is untouched by this spec; only the layer that turns it into pixels
changes shape.

## `TemplateDefinition`

```ts
type TemplateDefinition = {
  schemaVersion: 2
  id: string
  name: string
  description: string
  density: "Roomy" | "Balanced" | "Dense"
  atsSafe: boolean
  bestFor: string

  /** Page geometry + chrome. Was owned by the renderer wrapper in spec 05 — a
   *  printed page has to know its own size/margins/header/footer, so this
   *  moves into the definition itself. */
  page: PageConfig

  /** Named, reusable style fragments. Referenced by name from any node's
   *  `styles`; `extends` composes recursively, cycle-guarded. */
  styles: Record<string, StyleDef>

  /** Named, reusable node trees, each declaring the `$prop.*` keys it expects.
   *  Same self-containment rule as spec 05: one definition is one file, blocks
   *  never resolve outside their own `blocks` map. As of Batch 3
   *  (docs/user-request.md), this is enforced literally, not just by
   *  convention — `src/lib/cv-template-blocks.ts`'s `sharedBlocks` registry
   *  is gone; `classic.ts`/`two-column.ts`/`batch1-demo.ts` each define their
   *  own copy of the blocks they use (near-duplicates of each other by
   *  design, not re-shared). */
  blocks: Record<string, BlockDef>

  /** Human title + one-line description per `styles` key. Added Batch 3 to
   *  fix the Style tab's picker, which previously showed raw keys
   *  (`headerName`, `entryTitle`, ...) as labels. Optional — a key absent
   *  here falls back to a humanized version of the key itself. */
  stylesSchema?: Record<string, { title: string; description?: string }>

  /** Same idea, keyed by a `blocks` name — powers the Block tab's grouping
   *  (`src/lib/cv-template-core.ts`'s `collectBlockNodeIds`). */
  blocksSchema?: Record<string, { title: string; description?: string }>

  root: TemplateNode
}

type PageConfig = {
  size: "A4" | "LETTER" | "LEGAL"
  orientation?: "portrait" | "landscape"    // default "portrait"
  margin?: number                            // points, default 40
  fontFamily?: string                        // default "Helvetica"
  fontSize?: number                          // points, default 10 — the inherited base
  lineHeight?: number                        // default 1.4 — inherited, multiplies each node's own fontSize
  color?: string                             // default "#111827"
  header?: TemplateNode                      // rendered once, above `root`
  footer?: TemplateNode
  headerSpace?: number                       // points, top padding reserved when `header` is set, default 92
  footerSpace?: number                       // points, default 56
}
```

`pageSize: "A4" | "A4 / Letter"` (spec 05/03) is dropped in favor of `page.size` —
`"A4 / Letter"` was always a description string, not a real dual-geometry mode; a
`TemplateDefinition` now commits to one concrete page size, matching a real sheet of
paper.

## Units: points, not pixels

Every numeric `Style` value is a **point** (`1/72 inch`), not a pixel, as spec 05's
inline-`style`-as-`CSSProperties` model assumed — this keeps template authoring in the
same units as page geometry (`PageConfig.margin`, font sizes, etc.), all one consistent
scale. The DOM renderer scales every length by `K = 96/72` (≈1.333) when converting to
CSS pixels for on-screen display. `fontWeight`, `lineHeight`, `opacity`, `flex*`,
`zIndex`, `order`, `aspectRatio` are unitless and never scaled. String style values
(colors, `"1 solid #ccc"` border shorthand, etc.) pass through unscaled.

## Style vocabulary is a restricted CSS subset

A template's `Style` values are restricted to a flexbox-only subset of CSS (no CSS
grid, no `boxShadow`, no `cursor`, no `transition`, no `::marker`/pseudo-elements, no
`whiteSpace`, no `float`) — inherited from the `json-ui` reference format this spec is
modeled on. This is a **narrower surface than spec 05's "any `CSSProperties` value,"**
kept as the format's committed vocabulary rather than expanded back out. Bullet markers
stay literal glyph characters (spec 05's existing workaround).

```ts
type Style = Record<string, string | number>
type StyleDef = Style & { extends?: string[] }
```

`extends` composes recursively (later entries in the array override earlier ones' keys;
a name that lists itself directly or transitively is a no-op past the first occurrence,
not an infinite loop — same cycle guard as before).

## `TemplateNode`

Five node *shapes*, distinguished structurally (by which key is present) rather than by
a `type` discriminant literal — matching `json-ui`'s own dispatch order
(`repeat` → `block` → `if` → `join` → `tag`). Each is still a runtime-validated zod
variant; the union just isn't keyed by a `type` field anymore.

```ts
type BoxTag =
  | "div" | "header" | "aside" | "section"   // structural elements
  | "ul" | "li" | "span" | "p" | "h1" | "h2" | "h3" | "a"   // text-bearing elements

/** An element. `tag` omitted renders bare text (or an `<a>`/Text-with-link
 *  when `attrs.href` resolves non-empty) — no wrapping element at all, the
 *  same "text doesn't force a DOM node" capability spec 05's `TextNode` had,
 *  now folded into one node shape instead of a separate type. */
type ElementNode = {
  tag?: BoxTag
  id?: string                        // opt-in handle for settings (see below)
  styles?: string | string[]         // named style references, resolved left-to-right
  style?: Style                      // inline, applied last, wins over everything
  attrs?: Record<string, string>     // e.g. { href: "$item.url" } — each value resolved like any bind
  text?: string                      // literal, or a "$..." bind path — mutually exclusive with `children`
  children?: TemplateNode[]
}

/** Instantiates a named entry from `blocks`. `props` values are bind paths
 *  resolved in the *caller's* current scope, assigned into the callee's
 *  `$prop.*` namespace under the given key — replaces spec 05's `RefNode.with`. */
type BlockInstanceNode = {
  block: string
  id?: string
  props?: Record<string, string>
  styles?: string | string[]         // merged onto the block's own root styles, additive
  style?: Style
}

/** One instance of `repeat.block` per array item. `as` maps each item's own
 *  fields into the target block's `$prop.*` — the item itself is never
 *  implicitly in scope inside the repeated block, only what `as` forwards. */
type RepeatNode = {
  repeat: {
    id?: string
    block: string
    for: string                      // bind path to an array
    as?: Record<string, string>      // values resolved against { $item, $index, $data } — the pre-block scope
    filter?: { field: string; op: "in" | "not-in"; value: string[] }   // field relative to the raw item, before `as`
    sort?: { field: string; priority: string[] }                       // same "relative to raw item" rule
    tag?: BoxTag                     // wrapping element, default "div" → View
    style?: Style
    styles?: string | string[]
    separator?: TemplateNode         // rendered between consecutive items, not before the first
    merge?: {                        // added in Batch 1 (docs/user-request.md), see below
      text: string                   // resolved per item against { $item, $index } — interpolation-friendly, e.g. "$item.title"
      separator?: string             // between consecutive items, default ", "
      end?: string                   // appended once after the last item, default ""
    }
  }
}

/** Conditional — `json-ui` has no equivalent; CV rendering needs it (an
 *  entry's optional subtitle, kind-based branching) and spec 05's "no `eval`,
 *  closed comparison surface" reasoning still applies verbatim. */
type IfNode = {
  if: string                         // bind path
  id?: string
  equals?: string
  in?: string[]
  then: TemplateNode
  else?: TemplateNode
}

/** A fixed set of optional parts joined by a literal separator, blanks
 *  dropped — also not in `json-ui`, kept from spec 05 for the same reason
 *  (`"subtitle · studyType"`-style composition can't be expressed as a
 *  `repeat` over an array, since these are two distinct named fields). */
type JoinNode = {
  join: {
    id?: string
    parts: TemplateNode[]
    separator: string
    style?: Style
    styles?: string | string[]
  }
}

type TemplateNode =
  | ElementNode | BlockInstanceNode | RepeatNode | IfNode | JoinNode

type BlockDef = {
  /** Documents the `$prop.*` keys this block expects. Not runtime-enforced
   *  against every call site (that would need real type inference over bind
   *  paths); it's the authoring contract, checked by a human/reviewer, the
   *  way json-ui's own `props` list works. */
  props?: string[]
  node: TemplateNode
}
```

Falsy rule, empty propagation, and the education entry's "box wrapping a join + a
sibling `if`" pattern all carry over from spec 05 unchanged — none of that reasoning was
specific to the old node shapes.

### Scope and placeholders

Four sigils, matching `json-ui` exactly:

| Sigil | Resolves against |
|---|---|
| `$data.*` | The root `ResumeDocument` — reachable at *any* depth, regardless of nesting, same as `json-ui`'s `ctx.data` |
| `$prop.*` | The current block instance's `props` (or `repeat.as`'s mapped values) |
| `$item.*` | The current `repeat`'s loop item — **only visible while evaluating that `repeat`'s own `as`/`filter`/`sort`**, not inside the instantiated block itself (mirrors `json-ui`'s `renderRepeat`: `as` resolves against `{item, index}`, then the result is passed on as `$prop.*`) |
| `$index` | The current `repeat`'s loop index — same visibility rule as `$item` |

Two resolution modes, both handled by `resolveValue` (`src/lib/cv-template-core.ts`):

- **Whole-string** — the entire value is one sigil (`"$data.name"`, `"$prop.section.entries"`).
  Resolves to that value's raw type — array, object, number, whatever the path holds — not
  coerced to a string. This is what `repeat.for`, `if`, `filter`/`sort` fields, and most `text`
  values use.
- **Interpolated** (added Batch 1, `docs/user-request.md`) — one or more sigils embedded in a
  larger literal string, e.g. `"Hello, $data.name — $data.headline"`. Each embedded sigil is
  resolved and `String(...)`-coerced in place (`null`/`undefined` become `""`); the surrounding
  literal text passes through unchanged. A string containing `$` that doesn't match a sigil at
  all (e.g. `"$5.00"`) is left untouched.

Both modes share the same sigil grammar and root/path resolution — interpolation is purely a
different assembly of the same per-token lookup, so every root above works identically in either
mode.

This replaces spec 05's free-form named scope (`repeat`'s `as: "entry"`, `ref`'s
`with: {"section": "section"}`, reachable by that literal name at any descendant depth).
Auditing every existing block in `cv-template-blocks.ts` confirms **no block needs two
ancestor-named variables live at once** — `bulletList` only ever needs the list it's
handed, `entryBlock` only ever needs the entry it's handed — so the single-`$prop`
discipline costs nothing today and forces every block's real dependencies to be explicit
`props`, which is exactly what makes them addressable by a settings layer later.

`filter.field`/`sort.field` keep spec 05's one documented exception: resolved as a plain
path against the **raw candidate item**, before `as` mapping — not through the sigil
scope at all.

## `settings`: style overrides + node visibility

```ts
type TemplateSettings = {
  /** Keyed by style name (a key of `TemplateDefinition.styles`). Shallow-merged
   *  on top of that style's own resolved (extends-flattened) definition, so
   *  every node referencing the name picks up the override — this is *why*
   *  styles need names now, not just inline objects. */
  styles?: Record<string, Style>
  /** Keyed by a node's own `id`. `hidden: true` makes that node render as if
   *  it resolved empty — same empty-propagation rule as a falsy `if`, so a
   *  hidden node's ancestor `ElementNode` still disappears if it was the only
   *  visible child. `styles`/`text` (Batch 3, docs/user-request.md) patch
   *  that specific node's own `styles`/`text` field before it resolves —
   *  `text` goes through the same interpolation-aware `resolveValue` as any
   *  node's own `text`, so an override can be a sigil (`"$item.title"`) to
   *  rebind the node to different data, not just a literal replacement. For
   *  a `block`/`repeat` node (which has no literal text itself), the
   *  override patches the *instantiated block's own root node* instead of
   *  the wrapper — see `renderBlockInstance` in `template-node-renderer.tsx`. */
  nodes?: Record<string, { hidden?: boolean; styles?: string | string[]; text?: string }>
}
```

Resolution order per node, both backends: flatten each referenced style name
(`extends`, recursive) → shallow-merge `settings.styles[name]` onto that name's
flattened result → merge every referenced name left-to-right → merge the node's own
inline `style` last. Visibility is checked first, before any style work: a node with an
`id` present in `settings.nodes` and `hidden: true` short-circuits to `null`.

`id` is opt-in per node — a template author marks only the nodes worth exposing. As of
Batch 3, `classic.ts`/`two-column.ts`/`batch1-demo.ts` each mark a small, deliberate set
(a bullet marker's glyph, a keyword/contact separator, a section heading's/entry
container's style reference) — addressing **one node in the tree**, not one rendered
row out of the N a single `repeat` draws (e.g. the Skills section's entry container is
addressable independently of Work's, since they're different `repeat` nodes with
different ids — but overriding one still affects every item that `repeat` renders).
Nothing under `blocks`/`root` requires an `id` to render normally.
`src/lib/cv-template-core.ts`'s `collectBlockNodeIds` walks a definition's `root` and
every `blocks` entry it reaches, returning every `{id, blockName, hasText}` found —
the Block tab's data source (`persona-field-tree.tsx`).

(Batch 4, `docs/user-request.md`, Classic only: the contact/keyword separator glyphs
became literal `merge.separator` strings instead of their own styled nodes, so
`contactSeparatorText`/`keywordSeparator` no longer exist on `classic.ts` —
`bulletMarker`, `sectionHeadingInstance`, `entryBlockRepeatTight`/`Spaced` are
unchanged; `two-column.ts`/`batch1-demo.ts` keep their own copies of everything
untouched.)

`ResumeRender` and `TemplateNodeRenderer` both take an optional `settings?:
TemplateSettings` prop (default: none applied). `cvs.template_settings` (spec 08) is the
persisted settings, edited live via the CV detail page's Style/Page/Block tabs
(`persona-field-tree.tsx`) and passed through `cv-print.tsx` → `ResumeRender`.

## One core, one renderer

Shared module `src/lib/cv-template-core.ts` (mirrors `json-ui/src/jsonui/core.js`):
style flattening (`extends`, cycle guard, `settings.styles` merge) and scope/placeholder
resolution (`$data`/`$prop`/`$item`/`$index`). Framework-free, imported by the sole
renderer:

- **DOM renderer** — `src/components/cv/template-node-renderer.tsx`. Cheap, synchronous
  React tree. Used everywhere a template needs to become pixels: `TemplateCard`'s
  gallery thumbnail, `TemplateViewDialog`'s full preview, and `cv-print.tsx`'s print
  preview, which the browser's native `window.print()` (via `react-to-print`) turns into
  the actual printed/PDF-saved output. Scales pt → px by `K = 96/72`.

(An earlier revision of this spec also introduced an `@react-pdf/renderer`-based PDF
backend, `template-pdf-renderer.tsx`, that produced a real PDF file independent of the
browser. It was built, never wired into `cv-print.tsx` as the primary path, and was
deleted on the `native-print` branch — see the amendment note at the top.)

## What changes at the call sites

- **`src/pages/cv-print.tsx`** — a print preview over the DOM renderer, with a "Print"
  button that calls the browser's native `window.print()` (via `react-to-print`).
- **`src/components/cv/template-card.tsx`, `template-view-dialog.tsx`** — use
  `ResumeRender` → the DOM renderer, same as the print preview.
- **`src/lib/cv-templates.ts`** — `CvTemplate.definition: TemplateDefinition` stays the
  shape; `pageSize` field is dropped from `CvTemplate` (redundant with
  `definition.page.size`) — read from the definition instead of carried twice.
- **`src/lib/cv-template-defs/classic.ts`** — rewritten in the new format: a `styles`
  registry replaces Classic's inline `style` objects wherever a fragment repeats
  (section heading, entry title, muted text, etc.); `page` gains Classic's margin/font
  defaults. **Only Classic** — Sidebar/Compact/Academic were never ported under spec 05
  either (the repo's actual state today is "one real template"), so this spec's blast
  radius is one definition file, not four. (A `Two Column` template and a `cv-template-
  blocks.ts` shared-block registry were added afterward, then that registry was removed
  again — see the `blocks` field's doc comment above — so "one definition file" no
  longer holds by the time of Batch 3, but did at the point this spec was written.)

**Batch 4** (`docs/user-request.md`) reshaped `classic.ts` for compactness and
ATS/parser friendliness — Classic only, `two-column.ts`/`batch1-demo.ts` untouched:
- Header contact line: `repeat.merge` over `$data.contactParts` now renders one
  plain-text `<p>` ("email | phone | location | ...") instead of a `<ul>`/`<li>`
  list with a separate `|` glyph node.
- A regular entry's description plus its bullet content (responsibilities,
  highlights, courses, ...) renders as **one shared `<ul>`**, description leading
  as the first bullet (`repeat` directly over `ResumeEntry.bulletItems`, a new
  field — `summary` when present, then every `lineGroups` group's items
  flattened in) instead of a separate description paragraph plus one `<ul>` per
  group. `classic.ts` dropped the now-redundant `entrySummary` paragraph node
  and style.
- Skills no longer render one line per skill. `ResumeSection.skillGroups` (new,
  skill sections only — `persona.ts`'s `buildSkillGroups`, grouping by
  `inventory_items.category_id`/`skill_categories.position`, uncategorized skills
  under a trailing "Other") backs a new `skillCategoryList`/`skillCategoryLine`
  block pair rendering one bullet per category: "Languages: Go, TypeScript, ...".
  `entryBlock`'s old skill branch is gone — skill entries never reach it anymore.
- Bug fix along the way, not Batch-4-specific: `template-node-renderer.tsx`'s
  `renderElement` had a leaf text node with a `styles` but no `tag` return the
  raw string via an early shortcut, skipping `cssStyle` entirely — a style on an
  untagged text node was silently dropped (surfaced by the new Skills category
  label not rendering bold despite `styles: "entryTitle"`). Now falls back to a
  bare `<span style={cssStyle}>` when a style is actually present. Shared by
  every template/backend, not Classic-specific.

## Out of scope

Everything spec 05 already excluded, still excluded:
- A visual/WYSIWYG template editor (`json-ui`'s `BlockEditor`/`StyleEditor` are not
  ported — no template-authoring UI exists or is planned here).
- Any user-facing custom-template creation/import/export flow.
- The `cv_templates` Supabase table and its RLS policy.
- An expression language or `eval` — `filter`/`sort`/`if equals`/`if in` remain the
  entire comparison surface.

New to this spec:
- **A settings *editor* UI, or wiring `TemplateSettings` into a saved `cvs` row.** The
  type and the render-time plumbing exist; nothing produces or persists a real
  `TemplateSettings` value yet. This is the "later" from the reordering/persona-setting
  discussion (personas + templates + settings combining into a `cv`) — noted here so the
  format doesn't paint that future into a corner, not built now.
- **Hand-rolled pagination logic.** Native browser printing paginates overflowing
  content automatically; this spec doesn't add page-count estimation, orphan/widow
  control, or a page-break preview.
- **Porting Sidebar/Compact/Academic.** Only Classic moves to the new format as part of
  this spec's initial cut — the other three were never built under spec 05 either, so
  there is nothing to migrate for them yet.

**Removed on the `native-print` branch** (see the amendment note at the top): the
`@react-pdf/renderer` PDF backend (`template-pdf-renderer.tsx`) and its dependency;
`ElementNode.fixed`/`.break`/`.wrap` and the `PageNumberNode` shape (pagination hooks
that existed only for that backend, had zero effect in the DOM renderer, and were never
used by any template).

## Open points

1. **`schemaVersion` migration.** Still no migration story (spec 05's same open point,
   carried forward) — fine while nothing is stored in Supabase and the repo holds the
   only copy of `schemaVersion: 2`. Needs an answer before `cv_templates` (still
   unbuilt) holds anyone's edits.
