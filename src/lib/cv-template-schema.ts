import { z } from "zod"

/**
 * CV template format v2 — see docs/specs/07-cv-template-pdf-format.md.
 * Named `styles` registry with `extends` composition, `blocks` registry with
 * sigil-based scope ($data/$prop/$item/$index), point-based units, and
 * `page: PageConfig` inside the definition itself.
 */

export type Style = Record<string, string | number>

export type StyleDef = Style & { extends?: string[] }

export type PageSize = "A4" | "LETTER" | "LEGAL"

export type PageConfig = {
  size: PageSize
  orientation?: "portrait" | "landscape"
  margin?: number
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
  color?: string
  header?: TemplateNode
  footer?: TemplateNode
  headerSpace?: number
  footerSpace?: number
}

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
  | "a"

/** An element node (tag, text, or bare children). */
export type ElementNode = {
  tag?: BoxTag
  id?: string
  styles?: string | string[]
  style?: Style
  attrs?: Record<string, string>
  text?: string
  children?: TemplateNode[]
  fixed?: boolean
  break?: boolean
  wrap?: boolean
}

/** Block instance node. */
export type BlockInstanceNode = {
  block: string
  id?: string
  props?: Record<string, string>
  styles?: string | string[]
  style?: Style
}

/** Repeat node with nested repeat config. */
export type RepeatNode = {
  repeat: {
    id?: string
    block: string
    for: string
    as?: Record<string, string>
    filter?: { field: string; op: "in" | "not-in"; value: string[] }
    sort?: { field: string; priority: string[] }
    tag?: BoxTag
    style?: Style
    styles?: string | string[]
    separator?: TemplateNode
  }
}

/** Conditional node. */
export type IfNode = {
  if: string
  id?: string
  equals?: string
  in?: string[]
  then: TemplateNode
  else?: TemplateNode
}

/** Join node with nested join config. */
export type JoinNode = {
  join: {
    id?: string
    parts: TemplateNode[]
    separator: string
    style?: Style
    styles?: string | string[]
  }
}

/** Page number node. */
export type PageNumberNode = {
  pageNumber: true
  id?: string
  format?: string
  style?: Style
  styles?: string | string[]
}

export type TemplateNode =
  | ElementNode
  | BlockInstanceNode
  | RepeatNode
  | IfNode
  | JoinNode
  | PageNumberNode

export type BlockDef = {
  props?: string[]
  node: TemplateNode
}

export type TemplateSettings = {
  styles?: Record<string, Style>
  nodes?: Record<string, { hidden?: boolean }>
}

export type TemplateDefinition = {
  schemaVersion: 2
  id: string
  name: string
  description: string
  density: "Roomy" | "Balanced" | "Dense"
  atsSafe: boolean
  bestFor: string
  page: PageConfig
  styles: Record<string, StyleDef>
  blocks: Record<string, BlockDef>
  root: TemplateNode
}

// ---------------------------------------------------------------------------
// Runtime validation
// ---------------------------------------------------------------------------

const styleSchema: z.ZodType<Style> = z.record(
  z.string(),
  z.union([z.string(), z.number()])
)

const styleDefSchema: z.ZodType<StyleDef> = z
  .record(z.string(), z.union([z.string(), z.number()]))
  .and(
    z.object({
      extends: z.array(z.string()).optional(),
    })
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
  "a",
])

const pageConfigSchema = z.object({
  size: z.enum(["A4", "LETTER", "LEGAL"]),
  orientation: z.enum(["portrait", "landscape"]).optional(),
  margin: z.number().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().optional(),
  lineHeight: z.number().optional(),
  color: z.string().optional(),
  header: z.lazy(() => templateNodeSchema).optional(),
  footer: z.lazy(() => templateNodeSchema).optional(),
  headerSpace: z.number().optional(),
  footerSpace: z.number().optional(),
})

const templateNodeSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    elementNodeSchema,
    blockInstanceNodeSchema,
    repeatNodeSchema,
    ifNodeSchema,
    joinNodeSchema,
    pageNumberNodeSchema,
  ])
)

// `.strict()` on every node shape below: since none of these variants share a
// `type` discriminant, `z.union` tries each schema in declared order and keeps
// the first one that validates. Zod's default object mode silently *strips*
// unrecognized keys rather than rejecting them, so a non-strict `elementNodeSchema`
// (every field optional) would successfully — and wrongly — match an IfNode/
// RepeatNode/etc. by stripping away `if`/`then`/`repeat`/... down to `{}`.
// `.strict()` makes an unrecognized key a validation failure instead, so the
// union correctly falls through to the schema that actually owns those keys.
const elementNodeSchema = z
  .object({
    tag: boxTagSchema.optional(),
    id: z.string().optional(),
    styles: z.union([z.string(), z.array(z.string())]).optional(),
    style: styleSchema.optional(),
    attrs: z.record(z.string(), z.string()).optional(),
    text: z.string().optional(),
    children: z.array(templateNodeSchema).optional(),
    fixed: z.boolean().optional(),
    break: z.boolean().optional(),
    wrap: z.boolean().optional(),
  })
  .strict()

const blockInstanceNodeSchema = z
  .object({
    block: z.string(),
    id: z.string().optional(),
    props: z.record(z.string(), z.string()).optional(),
    styles: z.union([z.string(), z.array(z.string())]).optional(),
    style: styleSchema.optional(),
  })
  .strict()

const repeatNodeSchema = z
  .object({
    repeat: z
      .object({
        id: z.string().optional(),
        block: z.string(),
        for: z.string(),
        as: z.record(z.string(), z.string()).optional(),
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
        tag: boxTagSchema.optional(),
        style: styleSchema.optional(),
        styles: z.union([z.string(), z.array(z.string())]).optional(),
        separator: templateNodeSchema.optional(),
      })
      .strict(),
  })
  .strict()

const ifNodeSchema = z
  .object({
    if: z.string(),
    id: z.string().optional(),
    equals: z.string().optional(),
    in: z.array(z.string()).optional(),
    then: templateNodeSchema,
    else: templateNodeSchema.optional(),
  })
  .strict()

const joinNodeSchema = z
  .object({
    join: z
      .object({
        id: z.string().optional(),
        parts: z.array(templateNodeSchema),
        separator: z.string(),
        style: styleSchema.optional(),
        styles: z.union([z.string(), z.array(z.string())]).optional(),
      })
      .strict(),
  })
  .strict()

const pageNumberNodeSchema = z
  .object({
    pageNumber: z.literal(true),
    id: z.string().optional(),
    format: z.string().optional(),
    style: styleSchema.optional(),
    styles: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .strict()

const blockDefSchema = z.object({
  props: z.array(z.string()).optional(),
  node: templateNodeSchema,
})

export const templateDefinitionSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string(),
  name: z.string(),
  description: z.string(),
  density: z.enum(["Roomy", "Balanced", "Dense"]),
  atsSafe: z.boolean(),
  bestFor: z.string(),
  page: pageConfigSchema,
  styles: z.record(z.string(), styleDefSchema),
  blocks: z.record(z.string(), blockDefSchema),
  root: templateNodeSchema,
})

export const templateSettingsSchema = z.object({
  styles: z.record(z.string(), styleSchema).optional(),
  nodes: z.record(z.string(), z.object({ hidden: z.boolean().optional() }))
    .optional(),
})

/**
 * Parses and validates a `TemplateDefinition` at the point it's authored (or,
 * later, read out of Supabase) — a typo fails loudly here rather than
 * rendering wrong or crashing deep inside the renderer.
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
