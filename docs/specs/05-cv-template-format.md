# 05 — CV Template Format

A JSON format for CV *layouts* — the four things `src/components/cv/templates/*.tsx`
are today — so a template becomes data: storable in Supabase as `jsonb`, hand-editable
field by field, diffable, exportable/importable as a plain `.json` file. No template
logic lives in TypeScript components after this; one generic renderer interprets the
JSON for every template, built-in or (later) user-authored.

Builds on [03 — CV Selection](03-cv-selection.md), which drew the line this spec sits
right against: **templates never own content.** They receive an already-resolved
`ResumeDocument` and decide only how to arrange and style it. This spec does not move
that line — it just changes what "how to arrange and style it" is written in.

## Why

Today, `ClassicTemplate`/`SidebarTemplate`/`CompactTemplate`/`AcademicTemplate` are
React components. Changing a margin means editing `.tsx` and shipping a build. That's
fine for four built-ins one developer maintains, and wrong for anything beyond that:
storing a layout per user, letting someone tweak spacing without a PR, or exporting a
layout to hand to someone else. "Flexible to put in a database, edit a field, export as
JSON" only works if the layout *is* JSON — not a component that happens to be
data-driven in places.

## The idea, restated

Two things a template needs, kept as separate as spec 03 already keeps content and
layout:

```
ResumeDocument  →  TemplateContext   (content, extended with a few display-ready fields)
                          │
TemplateDefinition (JSON) │  →  generic renderer  →  React tree
                          ↓
                 (arrangement + inline style, data only)
```

`TemplateContext` is still built once, in code, from `ResumeDocument` — formatting a
date range or filtering out blank contact fields is logic, and logic belongs in a
tested function, not hand-rolled per template. `TemplateDefinition` is arrangement and
style only: which boxes, in what order, wearing what CSS. No formatting logic, no
branching on business rules, ever lives in it beyond the small set of primitives below.

## `TemplateContext`: what a template can bind against

`ResumeDocument` (spec 03) already excludes tables and resolves selection. It gains a
handful of fields whose only job is removing logic from the layer that must stay
logic-free — each one ports an existing helper (`primitives.tsx`,
`contact-line.tsx`) verbatim, just computed once instead of per template:

| Addition | Type | Replaces |
|---|---|---|
| `contactParts` | `string[]` | `ContactLine`'s inline `parts` array — email, phone, location, url, socials, already filtered to non-null |
| `sections[].entries[].kind` | `ItemKind` | `EntryBlock(entry, kind)`'s second argument — denormalized onto the entry so a block can branch on it without reaching into an ancestor scope |
| `sections[].entries[].dateRangeText` | `string \| null` | `formatEntryDates()` — single-date kinds (`award`, `certificate`, `publication`) vs ranges, "Present" for open-ended, already joined |
| `sections[].entries[].keywords` | `string[]` | `entry.lineGroups.find(g => g.kind === "keywords")?.items ?? []` — the skill entry's inline keyword suffix needs one specific group by name, not the whole array `EntryBlock` iterates for the generic case |

Nothing else changes shape. `details: Record<string, unknown>` stays a grab bag — a
template binds into it by path (`entry.details.studyType`) exactly as `asText()` does
today, and an absent key resolves to falsy, same as now.

## `TemplateDefinition`

```ts
type TemplateDefinition = {
  schemaVersion: 1
  id: string
  name: string
  description: string
  pageSize: "A4" | "A4 / Letter"
  density: "Roomy" | "Balanced" | "Dense"
  atsSafe: boolean
  bestFor: string
  /** Named, reusable node trees local to this definition. See "Modularity". */
  blocks: Record<string, TemplateNode>
  root: TemplateNode
}
```

The first seven fields are exactly `CvTemplate` today minus `component` — a template's
identity and metadata don't change, only how it renders.

**One definition is one self-contained file.** Everything it needs — including its own
copies of shared layout pieces like `Section` or `BulletList` — lives under `blocks`.
Nothing resolves against another file at render time. That's deliberate: a row pulled
out of the database, or a file dragged out of the repo, must render correctly on its
own. See "Modularity" for how the four built-ins avoid hand-duplicating those blocks
despite this.

## Style: inline, self-contained, no stylesheet

```ts
type Style = Record<string, string | number>
```

Same shape and unit rules as React's `style` prop — `fontSize: 24` means `24px`,
`fontWeight: 700` needs no unit, string values carry their own unit
(`letterSpacing: "0.12em"`). Every value is a literal (a real hex color, a real pixel
number) — never a Tailwind class name, never a token that needs a lookup table to mean
anything. The renderer applies `style` objects directly; nothing is compiled, nothing
is imported. A definition that only ever reached this codebase's renderer would still
be rendered correctly by anything else that understands `TemplateNode` — that
portability is the point of storing layout as JSON at all.

**This is a deliberate, scoped exception to this repo's "Tailwind only, never inline
`style={{}}`" convention.** That convention governs hand-authored components; this is a
generic renderer interpreting *data* — the same exception `primitives.tsx` already
carries for raw color values in the print layer, extended to the whole style surface
because the data now has to survive outside this codebase. No other component in the
app gains permission to use inline styles because of this.

Two things inline styles cannot reach — noted here rather than solved with a bigger
node type:

- **Pseudo-elements** (a colored bullet marker via `::marker`). Renders bullets as a
  literal glyph character styled like any other text, not a CSS list marker — visually
  identical, no pseudo-element required.
- **`@media print` overrides.** These are page *chrome* (shadow for on-screen preview,
  removed when printing), not template content, and stay owned by the renderer's fixed
  page wrapper — the same place `ResumePage`'s `print:` classes live today. A
  `TemplateDefinition`'s `root` only ever describes the page's interior.

## `TemplateNode`

Six kinds, closed set:

```ts
type TemplateNode =
  | BoxNode
  | TextNode
  | JoinNode
  | RepeatNode
  | IfNode
  | RefNode

type BoxTag =
  | "div" | "header" | "aside" | "section"
  | "ul" | "li" | "span" | "p" | "h1" | "h2" | "h3"

/** A container element. */
type BoxNode = {
  type: "box"
  tag?: BoxTag                 // default "div"
  style?: Style
  children?: TemplateNode[]
}

/**
 * Text — either bound to a path or a literal string, never both. `literal`
 * is what a separator glyph, unit of punctuation, or hardcoded label is —
 * `bind` alone cannot express these, since it only ever resolves a path.
 *
 * `href`, when given, is itself a bind path resolved to a URL; if that
 * resolves truthy the node renders as `<a href>` around its text instead of
 * plain text — same falsy rule as everywhere else, so an entry with no URL
 * silently renders as plain text rather than a dead link. Renders nothing at
 * all if its own text (`bind` or `literal`) is falsy, same as before.
 */
type TextNode = {
  type: "text"
  style?: Style
  href?: string
} & ({ bind: string } | { literal: string })

/**
 * A fixed set of optional parts, joined by a literal separator, blanks
 * dropped. Replaces ContactLine's dot-separated line and EntryBlock's
 * "subtitle · study type" composition — the recurring "combine whatever
 * of these is present" pattern, generalized once instead of hand-rolled
 * per template.
 */
type JoinNode = {
  type: "join"
  parts: TemplateNode[]
  separator: string
  style?: Style
}

/** One child per array item. `as` names the item in the child's scope. */
type RepeatNode = {
  type: "repeat"
  bind: string
  as: string
  tag?: BoxTag                 // wrapping element, default "div"
  style?: Style
  filter?: { field: string; op: "in" | "not-in"; value: string[] }
  sort?: { field: string; priority: string[] }   // unlisted values keep relative order, sorted after listed ones
  /** Rendered between consecutive items — not before the first. */
  separator?: TemplateNode
  child: TemplateNode
}

/** Conditional. Defaults to truthy/falsy; `equals`/`in` compare a resolved string. */
type IfNode = {
  type: "if"
  bind: string
  equals?: string
  in?: string[]
  then: TemplateNode
  else?: TemplateNode
}

/** Instantiates a named entry from `blocks`, passing scope variables in by name. */
type RefNode = {
  type: "ref"
  block: string
  with?: Record<string, string>
}
```

Falsy, for `if`, for a bare `TextNode`/omitted array in `repeat`, and for `TextNode.href`:
`null`, `undefined`, `""`, `[]`. (Note this is stricter than raw JS truthiness — an empty
array is truthy in JS but must hide a section here, same as `document.summary === ""`
must hide a paragraph.)

**Empty propagation.** A `box` whose `children` array was given but every entry in it
resolves to no visible output renders `null` itself, not an empty element — and this
propagates recursively (a `box` wrapping only an empty `join` disappears too). This is
what lets `EntryBlock`'s `{condition ? <p>...</p> : null}` pattern
(`primitives.tsx:146-151`, the education entry's `subtitle · studyType (score)` line)
become an unconditionally-present `box` wrapping a `join` — the `join` already drops
blank parts and yields nothing when none survive, and the rule above means the `<p>`
around it vanishes too rather than leaving a hollow, empty paragraph in the DOM. Scoped
deliberately to "`children` given but all-empty" — a `box` with no `children` key at
all still renders as a normal, if pointless, empty element.

### Binding and scope

A bind path is dot-separated (`"section.heading"`, `"entry.details.studyType"`).
Resolution is **name-based, not depth-based**: the root scope is `TemplateContext`
itself (bind directly, e.g. `"name"`, `"sections"`); a `repeat`'s `as` and a `ref`'s
`with` each introduce a named variable visible to every descendant node, however deeply
nested, until a nearer node shadows the same name. This is what lets an `entryBlock`
block, instantiated from inside a `repeat as="entry"`, reach back to `entry.kind`
without the block needing to know how many levels of `box` sit between them.

`filter.field` and `sort.field` are the one exception — paths relative to the
**candidate item itself**, evaluated before it's bound to `as` (so `"kind"`, not
`"section.kind"`).

## Modularity: `blocks` and `ref`

The four built-ins share real behavior today — `Section`, `EntryBlock`, `BulletList`,
`SectionHeading` in `primitives.tsx` — because a job entry doesn't render differently
between Classic and Compact, only the space around it does. `blocks` is that same
reuse, expressed as data instead of an import:

```json
"blocks": {
  "sectionHeading": { "type": "box", "tag": "h2", "style": { "...": "..." },
    "children": [{ "type": "text", "bind": "section.heading" }] },
  "bulletList": { "type": "repeat", "bind": "group.items", "as": "item",
    "tag": "ul", "child": { "type": "box", "tag": "li",
      "children": [{ "type": "text", "bind": "item" }] } },
  "entryBlock": { "type": "if", "bind": "entry.kind", "equals": "skill",
    "then": "...", "else": "..." },
  "section": { "type": "box", "children": [
    { "type": "ref", "block": "sectionHeading", "with": { "section": "section" } },
    { "type": "repeat", "bind": "section.entries", "as": "entry",
      "child": { "type": "ref", "block": "entryBlock", "with": { "entry": "entry" } } }
  ] }
}
```

Sidebar's rail and main column both instantiate the same `section` block — two
`ref`s, one definition, exactly like today's two `.map(... <Section />)` calls sharing
one component. `with` is how a value crosses into a block under whatever name the block
expects — `{"section": "section"}` passes the caller's `section` variable in under the
same name; nothing stops renaming it if a block wants a different local name.

**This does not create cross-file sharing**, by design — see "One definition is one
self-contained file" above. The four built-ins authoring the same `entryBlock`,
`bulletList`, etc. four times over is a real cost, paid once, at the boundary this spec
draws deliberately: authoring-time duplication in exchange for zero runtime
dependencies. Plan-level work spreads that cost by generating the four `blocks` maps
from one shared TypeScript source at build/seed time — an authoring convenience,
invisible to anything that later reads the JSON back out.

## Worked example: Classic, abridged

```json
{
  "schemaVersion": 1,
  "id": "classic",
  "name": "Classic",
  "description": "A centred header over full-width sections.",
  "pageSize": "A4 / Letter",
  "density": "Balanced",
  "atsSafe": true,
  "bestFor": "Most applications, and anything going through a job portal",
  "blocks": { "...": "sectionHeading / bulletList / entryBlock / section, as above" },
  "root": {
    "type": "box",
    "style": { "padding": "48px 56px", "fontSize": 12.5, "color": "#171717" },
    "children": [
      { "type": "box", "tag": "header",
        "style": { "display": "flex", "flexDirection": "column",
                   "alignItems": "center", "gap": 4, "textAlign": "center" },
        "children": [
          { "type": "box", "tag": "h1",
            "style": { "fontSize": 24, "fontWeight": 700, "letterSpacing": "-0.02em" },
            "children": [{ "type": "text", "bind": "name" }] },
          { "type": "if", "bind": "headline",
            "then": { "type": "box", "tag": "p", "style": { "fontSize": 13, "color": "#525252" },
                      "children": [{ "type": "text", "bind": "headline" }] } },
          { "type": "repeat", "bind": "contactParts", "as": "part", "tag": "p",
            "style": { "display": "flex", "flexWrap": "wrap", "justifyContent": "center",
                       "gap": "0 8px", "fontSize": 11, "color": "#525252" },
            "separator": { "type": "text", "literal": "·", "style": { "color": "#a3a3a3" } },
            "child": { "type": "text", "bind": "part" } }
        ] },
      { "type": "if", "bind": "summary",
        "then": { "type": "box", "tag": "p",
                  "style": { "marginTop": 20, "textAlign": "center", "lineHeight": 1.6, "color": "#404040" },
                  "children": [{ "type": "text", "bind": "summary" }] } },
      { "type": "repeat", "bind": "sections", "as": "section", "tag": "div",
        "style": { "marginTop": 28, "display": "flex", "flexDirection": "column", "gap": 24 },
        "child": { "type": "ref", "block": "section", "with": { "section": "section" } } }
    ]
  }
}
```

A link, for reference (a project entry's URL, shown as its title): `{ "type": "text",
"bind": "entry.title", "href": "entry.url" }` — plain text if `entry.url` is null,
`<a href="...">` around the same text otherwise.

## Rendering

One component, `TemplateNodeRenderer`, walks a `TemplateNode` against a scope (starting
as `TemplateContext`) and returns a React tree. It replaces the `component` field
`CvTemplate` carries today; the only two call sites that touch it are
`src/lib/cv-templates.ts` (the entry gains `definition: TemplateDefinition` in place of
`component: TemplateComponent`) and `src/components/cv/templates/index.tsx`
(`TemplateRender` renders `<TemplateNodeRenderer definition={template.definition}
context={document} />` instead of `<template.component document={document} />` — spec's
`TemplateContext` additions live directly on `ResumeDocument`, so no separate builder
call is needed). Everything downstream — `ResumeRender`, `TemplateCard`,
`TemplateViewDialog`, `pages/templates.tsx` — already goes through `templateId` and
never imports a template component directly, so nothing there changes.

## Storage (future, not this spec's scope to build)

The motivating use case — a template someone owns, edits, exports — implies a table
shaped like the rest of this schema:

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles(id)`, nullable | null = built-in, shipped with the app |
| `name` | `text` | |
| `definition` | `jsonb` | a `TemplateDefinition`, whole |
| `schema_version` | `int` | matches `TemplateDefinition.schemaVersion`, so a renderer can refuse or migrate a stale row instead of guessing |
| `note` / `deleted_at` / `created_at` / `updated_at` | — | same conventions as every other table in spec 02/03 |

Not built as part of this initiative. The built-in four ship as static
`TemplateDefinition` values in the repo (mirroring where `cvTemplates` lives today)
until a template editor exists to justify the table and its RLS policy. Recorded here
so the format doesn't paint that future into a corner — `jsonb` plus a version column is
sufficient the day it's needed.

## Out of scope

- A visual/WYSIWYG template editor.
- Any user-facing flow for creating, saving, or importing a custom template.
- The `cv_templates` table and its migration (see Storage, above).
- An expression language or `eval` of any kind — `filter`/`sort`/`if equals`/`in` are
  the entire comparison surface, deliberately fixed and small, so a `TemplateDefinition`
  from an untrusted source (a user's own custom template, later) can never execute
  anything.
- Changing where a CV's template choice lives — spec 03 already settled that a CV
  stores no template and this spec doesn't touch `cvs`, `cv_sections`, `cv_items`, or
  `cv_lines`.

## Open points

1. ~~Literal text inside a definition.~~ **Resolved.** `TextNode` takes `bind` XOR
   `literal` (never both, never neither) — no sigil convention, no string parsing at
   render time; the runtime schema (Open point 4) enforces the exclusivity directly.
2. ~~Whether a code-level `slot` escape hatch is needed.~~ **Resolved — not needed.**
   Dry-running the six hardest fragments across all four real templates on paper
   (`EntryBlock`'s three-way kind branch, the skill entry's keyword suffix, the
   education entry's `subtitle · studyType (score)` line, Sidebar's stacked contact
   block, Academic's priority reorder, Sidebar's rail/main filter) — every one is
   expressible with `join` + `if equals/in` + the empty-propagation rule above + one
   extra `TemplateContext` field (`keywords`, added above). No `slot` node type
   exists. If a future template finds a genuine gap these fragments didn't
   anticipate, that is a new, specific addition to bring back here — not a reason to
   add a generic code-escape pre-emptively.
3. **`schemaVersion` has no migration story yet** — only the column to hang one on
   later. Fine while there is one version and zero stored rows; needs an answer before
   the `cv_templates` table (Storage, above) holds anyone's edits.
4. ~~Validation.~~ **Resolved.** A zod discriminated union on `type`, mirroring the
   `TemplateNode` variants above, with `TextNode`'s `bind`/`literal` exclusivity
   enforced via `.refine()`. `zod` is a new dependency (not in `package.json` today).
