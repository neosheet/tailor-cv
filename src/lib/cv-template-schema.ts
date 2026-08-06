import { z } from "zod"

/**
 * A JSON format for CV layouts — see docs/specs/05-cv-template-format.md.
 *
 * `TemplateDefinition` replaces a template's `.tsx` component: arrangement and
 * style only, no formatting logic, so it can be stored as `jsonb`, hand-edited,
 * or exported/imported as a plain file.
 */

export type Style = Record<string, string | number>

export type BoxTag =
  | "div"
  | "header"
  | "aside"
  | "section"
  | "ul"
  | "li"
  | "span"
  | "p"
  | "h1"
  | "h2"
  | "h3"

/** A container element. */
export type BoxNode = {
  type: "box"
  tag?: BoxTag
  style?: Style
  children?: TemplateNode[]
}

/**
 * Text — either bound to a path or a literal string, never both. `href`, when
 * given, is itself a bind path resolved to a URL; if that resolves truthy the
 * node renders as `<a href>` around its text instead of plain text.
 */
export type TextNode = {
  type: "text"
  style?: Style
  href?: string
} & ({ bind: string } | { literal: string })

/** A fixed set of optional parts, joined by a literal separator, blanks dropped. */
export type JoinNode = {
  type: "join"
  parts: TemplateNode[]
  separator: string
  style?: Style
}

/** One child per array item. `as` names the item in the child's scope. */
export type RepeatNode = {
  type: "repeat"
  bind: string
  as: string
  tag?: BoxTag
  style?: Style
  filter?: { field: string; op: "in" | "not-in"; value: string[] }
  sort?: { field: string; priority: string[] }
  /** Rendered between consecutive items — not before the first. */
  separator?: TemplateNode
  child: TemplateNode
}

/** Conditional. Defaults to truthy/falsy; `equals`/`in` compare a resolved string. */
export type IfNode = {
  type: "if"
  bind: string
  equals?: string
  in?: string[]
  then: TemplateNode
  else?: TemplateNode
}

/** Instantiates a named entry from `blocks`, passing scope variables in by name. */
export type RefNode = {
  type: "ref"
  block: string
  with?: Record<string, string>
}

export type TemplateNode =
  | BoxNode
  | TextNode
  | JoinNode
  | RepeatNode
  | IfNode
  | RefNode

export type TemplateDefinition = {
  schemaVersion: 1
  id: string
  name: string
  description: string
  pageSize: "A4" | "A4 / Letter"
  density: "Roomy" | "Balanced" | "Dense"
  atsSafe: boolean
  bestFor: string
  /** Named, reusable node trees local to this definition. */
  blocks: Record<string, TemplateNode>
  root: TemplateNode
}

// ---------------------------------------------------------------------------
// Runtime validation
// ---------------------------------------------------------------------------

const styleSchema: z.ZodType<Style> = z.record(
  z.string(),
  z.union([z.string(), z.number()])
)

const boxTagSchema = z.enum([
  "div",
  "header",
  "aside",
  "section",
  "ul",
  "li",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
])

// `z.union` rather than `z.discriminatedUnion`: `textNodeSchema`'s `.refine()`
// (enforcing `bind`/`literal` exclusivity) drops the discriminant metadata a
// discriminated union needs, so a plain union is what actually typechecks here.
// Typed `ZodTypeAny` (not `ZodType<TemplateNode>`) only to break the
// self-referential circularity — `.refine()`'s runtime-only XOR check can
// never structurally match `TemplateNode`'s narrower hand-written union, so
// validated input is cast to `TemplateDefinition` at `parseTemplateDefinition`
// instead, where it actually matters.
const templateNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    boxNodeSchema,
    textNodeSchema,
    joinNodeSchema,
    repeatNodeSchema,
    ifNodeSchema,
    refNodeSchema,
  ])
)

const boxNodeSchema = z.object({
  type: z.literal("box"),
  tag: boxTagSchema.optional(),
  style: styleSchema.optional(),
  children: z.array(templateNodeSchema).optional(),
})

const textNodeSchema = z
  .object({
    type: z.literal("text"),
    style: styleSchema.optional(),
    href: z.string().optional(),
    bind: z.string().optional(),
    literal: z.string().optional(),
  })
  .refine(
    (node) => (node.bind !== undefined) !== (node.literal !== undefined),
    {
      message: "TextNode requires exactly one of `bind` or `literal`.",
      path: ["bind"],
    }
  )

const joinNodeSchema = z.object({
  type: z.literal("join"),
  parts: z.array(templateNodeSchema),
  separator: z.string(),
  style: styleSchema.optional(),
})

const repeatNodeSchema = z.object({
  type: z.literal("repeat"),
  bind: z.string(),
  as: z.string(),
  tag: boxTagSchema.optional(),
  style: styleSchema.optional(),
  filter: z
    .object({
      field: z.string(),
      op: z.enum(["in", "not-in"]),
      value: z.array(z.string()),
    })
    .optional(),
  sort: z
    .object({
      field: z.string(),
      priority: z.array(z.string()),
    })
    .optional(),
  separator: templateNodeSchema.optional(),
  child: templateNodeSchema,
})

const ifNodeSchema = z.object({
  type: z.literal("if"),
  bind: z.string(),
  equals: z.string().optional(),
  in: z.array(z.string()).optional(),
  then: templateNodeSchema,
  else: templateNodeSchema.optional(),
})

const refNodeSchema = z.object({
  type: z.literal("ref"),
  block: z.string(),
  with: z.record(z.string(), z.string()).optional(),
})

export const templateDefinitionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  pageSize: z.enum(["A4", "A4 / Letter"]),
  density: z.enum(["Roomy", "Balanced", "Dense"]),
  atsSafe: z.boolean(),
  bestFor: z.string(),
  blocks: z.record(z.string(), templateNodeSchema),
  root: templateNodeSchema,
})

/**
 * Parses and validates a `TemplateDefinition` at the point it's authored (or,
 * later, read out of Supabase) — a typo fails loudly here rather than
 * rendering wrong or crashing deep inside `TemplateNodeRenderer`.
 */
export function parseTemplateDefinition(input: unknown): TemplateDefinition {
  const result = templateDefinitionSchema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid TemplateDefinition: ${issues}`)
  }
  return result.data as TemplateDefinition
}
