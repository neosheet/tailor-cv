# 07 — CV Template Format v2: JSON-UI structure + real PDF output

**Supersedes [05 — CV Template Format](05-cv-template-format.md).** Spec 05's six-node
closed set (`box`/`text`/`join`/`repeat`/`if`/`ref`), inline-only `Style`, and
"page chrome lives outside `TemplateDefinition`" rule are all replaced below. Spec 05
stays in the repo as the design record for *why* those choices were made the first
time — several of its reasoning (empty propagation, name-based scope, no `eval`) still
holds and is carried forward, just expressed differently.

Builds on [03 — CV Selection](03-cv-selection.md), unchanged: **templates never own
content.** They still receive an already-resolved `ResumeDocument` and decide only how
to arrange and style it.

## Why this reopens a "fully settled" spec

Spec 05 shipped one template ("Classic") against a schema modeled as a closed set of
CV-specific node types with inline-only styling and a fixed, code-owned page wrapper.
Two things changed the requirements:

1. **A concrete reference format** (`json-ui`, reviewed directly) showed a cleaner split
   between *arrangement* (`tag`/`attrs`/`children`), *reusable style* (a named `styles`
   registry with `extends`), and *reusable structure* (`blocks` instantiated with
   explicit `props`, addressed by `$prop.`/`$item.`/`$data.` placeholders instead of
   free-form named scope variables). That split is exactly what's needed to let a later
   settings layer target *a style* or *a node* by name instead of only by editing JSON
   in place.
2. **Real PDF output.** `json-ui` isn't one renderer — it's one document format
   (`styles`/`blocks`/`data`/`page`/`root`) driving two backends: a DOM renderer for
   cheap on-screen preview, and an `@react-pdf/renderer` backend that produces the
   actual PDF file, with the DOM preview explicitly documented as an *approximation* of
   the PDF, not the other way around. `tailor-cv` today only has the DOM approximation
   (`cv-print.tsx` calls `window.print()`) — there is no real generated file. This spec
   adopts the same two-backend split so a "Download PDF" button can exist.

## The idea, restated

```
ResumeDocument  →  TemplateContext          (content — unchanged from spec 03/05)
                          │
TemplateDefinition (JSON) │  →  shared core (scope + style resolution)
                          ↓            │
              (arrangement, named          ├─→  DOM backend    → React tree (preview)
               styles, page geometry)      └─→  PDF backend    → real PDF (react-pdf)
```

One JSON document, two leaf renderers sharing one resolution core — mirroring
`json-ui`'s `core.js` / `renderer.jsx` / `pdf/renderPdf.js` split. Content resolution
(`ResumeDocument`) is untouched by this spec; only the layer that turns it into pixels
or PDF bytes changes shape.

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
   *  real PDF has to know its own size/margins/header/footer, so this moves
   *  into the definition itself. */
  page: PageConfig

  /** Named, reusable style fragments. Referenced by name from any node's
   *  `styles`; `extends` composes recursively, cycle-guarded. */
  styles: Record<string, StyleDef>

  /** Named, reusable node trees, each declaring the `$prop.*` keys it expects.
   *  Same self-containment rule as spec 05: one definition is one file, blocks
   *  never resolve outside their own `blocks` map. */
  blocks: Record<string, BlockDef>

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
  header?: TemplateNode                      // repeats on every page (PDF backend); rendered once (DOM backend)
  footer?: TemplateNode
  headerSpace?: number                       // points, top padding reserved when `header` is set, default 92
  footerSpace?: number                       // points, default 56
}
```

`pageSize: "A4" | "A4 / Letter"` (spec 05/03) is dropped in favor of `page.size` —
`"A4 / Letter"` was always a description string, not a real dual-geometry mode; a
`TemplateDefinition` now commits to one concrete page size the way a real PDF must.

## Units: points, not pixels

Every numeric `Style` value is now a **point** (`1/72 inch`), matching `@react-pdf/renderer`'s
native unit — not a pixel, as spec 05's inline-`style`-as-`CSSProperties` model assumed.
The DOM backend scales every length by `K = 96/72` (≈1.333) when converting to CSS
pixels, so the on-screen preview stays visually proportional to the real PDF rather than
independently authored. `fontWeight`, `lineHeight`, `opacity`, `flex*`, `zIndex`,
`order`, `aspectRatio` are unitless and never scaled, matching `@react-pdf/renderer`'s
own convention. String style values (colors, `"1 solid #ccc"` border shorthand, etc.)
pass through unscaled on both backends.

## Style vocabulary is now the `@react-pdf/renderer` CSS subset

Because the DOM preview's whole purpose is to approximate the real PDF, a template's
`Style` values are restricted to what `@react-pdf/renderer` actually supports — a
strict subset of CSS (flexbox layout, no CSS grid, no `boxShadow`, no `cursor`, no
`transition`, no `::marker`/pseudo-elements, no `whiteSpace`, no `float`). This is a
**narrower surface than spec 05's "any `CSSProperties` value,"** traded for both
backends staying honest with each other. Bullet markers stay literal glyph characters
(spec 05's existing workaround), now for both backends, not just the DOM one.

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
  | "div" | "header" | "aside" | "section"   // structural → react-pdf View
  | "ul" | "li" | "span" | "p" | "h1" | "h2" | "h3" | "a"   // text-bearing → react-pdf Text

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
  /** Pagination, PDF backend only — no-op on the DOM backend beyond an optional visual divider for `break`. */
  fixed?: boolean                    // repeats on every page (only meaningful inside `page.header`/`page.footer`)
  break?: boolean                    // forces a page break before this node
  wrap?: boolean                     // false = never split this node across a page boundary, default true
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

/** PDF-native page-number stamp. Static on the DOM backend (no real pages to
 *  count there); a react-pdf `render` callback on the PDF backend. */
type PageNumberNode = {
  pageNumber: true
  id?: string
  format?: string                    // "{n} / {t}", default as shown
  style?: Style
  styles?: string | string[]
}

type TemplateNode =
  | ElementNode | BlockInstanceNode | RepeatNode | IfNode | JoinNode | PageNumberNode

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

Four sigils, matching `json-ui` exactly, each a **whole-string** reference (no
interpolation into a larger string):

| Sigil | Resolves against |
|---|---|
| `$data.*` | The root `ResumeDocument` — reachable at *any* depth, regardless of nesting, same as `json-ui`'s `ctx.data` |
| `$prop.*` | The current block instance's `props` (or `repeat.as`'s mapped values) |
| `$item.*` | The current `repeat`'s loop item — **only visible while evaluating that `repeat`'s own `as`/`filter`/`sort`**, not inside the instantiated block itself (mirrors `json-ui`'s `renderRepeat`: `as` resolves against `{item, index}`, then the result is passed on as `$prop.*`) |
| `$index` | The current `repeat`'s loop index — same visibility rule as `$item` |

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
   *  visible child. */
  nodes?: Record<string, { hidden?: boolean }>
}
```

Resolution order per node, both backends: flatten each referenced style name
(`extends`, recursive) → shallow-merge `settings.styles[name]` onto that name's
flattened result → merge every referenced name left-to-right → merge the node's own
inline `style` last. Visibility is checked first, before any style work: a node with an
`id` present in `settings.nodes` and `hidden: true` short-circuits to `null`.

`id` is opt-in per node — a template author marks only the nodes worth exposing (e.g. a
skill entry's proficiency line, once that field exists), not every node in the tree.
Nothing under `blocks`/`root` requires an `id` to render normally.

`ResumeRender`, the new PDF preview/download components, and `TemplateNodeRenderer`
itself all gain an optional `settings?: TemplateSettings` prop (default: none applied).
**No caller passes one yet** — wiring an actual settings *editor*, and the
persona/template/CV combination that owns saved settings, is future work (see "Out of
scope").

## Two backends, one core

New shared module, `src/lib/cv-template-core.ts` (mirrors `json-ui/src/jsonui/core.js`):
style flattening (`extends`, cycle guard, `settings.styles` merge) and scope/placeholder
resolution (`$data`/`$prop`/`$item`/`$index`). Framework-free, imported by both:

- **DOM backend** — `src/components/cv/template-node-renderer.tsx`, rewritten against
  the new node shapes. Cheap, synchronous React tree. Used wherever a fast on-screen
  render is enough and no real file is needed: `TemplateCard`'s gallery thumbnail,
  `TemplateViewDialog`'s full preview. Scales pt → px by `K = 96/72`. This is the
  **approximation** — matches `json-ui`'s `PrintHtml`'s own framing ("the PDF remains
  the source of truth").
- **PDF backend** — new `src/components/cv/template-pdf-renderer.tsx`, built on
  `@react-pdf/renderer` (`Document`/`Page`/`View`/`Text`/`Image`, new dependency, not in
  `package.json` today). `BoxTag`s split into `TEXT_TAGS` (→ `Text`) vs. structural
  (→ `View`) exactly as `json-ui`'s `renderPdf.js` does; unsupported `Style` keys are
  dropped defensively even though authors shouldn't be using them (belt-and-suspenders,
  since a hand-edited or future DB-sourced definition could). This produces the **actual
  PDF** — the file a "Download" button hands the user, and what `<PDFViewer>` (from
  `@react-pdf/renderer`) shows for a true print preview.

## What changes at the call sites

- **`src/pages/cv-print.tsx`** — stops being a `window.print()` page. Becomes a PDF
  preview: `<PDFViewer>` wrapping the PDF backend's built document, plus a
  `PDFDownloadLink`/"Download PDF" button replacing today's "Print" button. This is the
  actual point of building the PDF backend — without this call site changing, the new
  backend has no consumer.
- **`src/components/cv/template-card.tsx`, `template-view-dialog.tsx`** — keep using
  `ResumeRender` → the DOM backend. Unchanged in spirit (still a cheap approximation for
  a gallery of cards), reimplemented under the hood against the new schema.
- **`src/lib/cv-templates.ts`** — `CvTemplate.definition: TemplateDefinition` stays the
  shape; `pageSize` field is dropped from `CvTemplate` (redundant with
  `definition.page.size`) — read from the definition instead of carried twice.
- **`src/lib/cv-template-defs/classic.ts`, `cv-template-blocks.ts`** — rewritten in the
  new format: a `styles` registry replaces Classic's inline `style` objects wherever a
  fragment repeats (section heading, entry title, muted text, etc.); `page` gains
  Classic's margin/font defaults. **Only Classic** — Sidebar/Compact/Academic were never
  ported under spec 05 either (the repo's actual state today is "one real template"),
  so this spec's blast radius is one definition file, not four.

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
- **Hand-rolled pagination logic beyond `fixed`/`break`/`wrap`.** `@react-pdf/renderer`
  paginates overflowing content automatically; this spec doesn't add page-count
  estimation, orphan/widow control, or a page-break preview in the DOM backend beyond
  the visual divider `json-ui`'s `PrintHtml` already uses for `break`.
- **Porting Sidebar/Compact/Academic.** Only Classic moves to the new format as part of
  this spec's initial cut — the other three were never built under spec 05 either, so
  there is nothing to migrate for them yet.

## Open points

1. **`schemaVersion` migration.** Still no migration story (spec 05's same open point,
   carried forward) — fine while nothing is stored in Supabase and the repo holds the
   only copy of `schemaVersion: 2`. Needs an answer before `cv_templates` (still
   unbuilt) holds anyone's edits.
2. **`@react-pdf/renderer` font handling.** `json-ui` registers system/Helvetica-ish
   fonts and disables hyphenation; `tailor-cv` currently uses `Geist` (via
   `@fontsource-variable/geist`) for its own UI, but a resume PDF likely wants a
   PDF-safe serif/sans pairing `@react-pdf/renderer` actually ships metrics for
   (Helvetica/Times, its built-ins) rather than a variable web font — resolved during
   implementation, not a blocking design question.
3. **Whether `CvPrintPage`'s "Download PDF" filename/metadata (title, author) matters
   for this pass.** `@react-pdf/renderer`'s `<Document>` supports PDF metadata; not
   specified here, left to implementation judgment (e.g. `{personaName} — {template.name}.pdf`).
