import { createElement, Fragment, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import {
  resolveValue,
  resolveStyleObject,
  type Style,
  type TemplateScope,
} from "@/lib/cv-template-core"
import type {
  BlockDef,
  BlockInstanceNode,
  ElementNode,
  IfNode,
  JoinNode,
  PageConfig,
  RepeatNode,
  TemplateDefinition,
  TemplateNode,
  TemplateSettings,
} from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/persona"

/**
 * DOM renderer for spec 07 CV templates.
 * Mirrors json-ui/renderer.jsx but adapted to spec 07's exact shapes.
 * Uses shared core (resolveValue, resolveStyleObject) for scope and style resolution.
 */

/** Unitless style keys never scaled by K = 96/72. */
const UNITLESS = new Set([
  "fontWeight",
  "lineHeight",
  "opacity",
  "flexGrow",
  "flexShrink",
  "flex",
  "order",
  "aspectRatio",
  "zIndex",
])

/** Scale factor: 96 DPI (CSS px) / 72 (points). */
const K = 96 / 72

/**
 * Yoga-style shorthands (inherited from the json-ui reference format) that
 * plain CSS doesn't understand — expanded to real longhands so they aren't
 * silently dropped.
 */
const SHORTHAND: Record<string, [keyof CSSProperties, keyof CSSProperties]> = {
  paddingVertical: ["paddingTop", "paddingBottom"],
  paddingHorizontal: ["paddingLeft", "paddingRight"],
  marginVertical: ["marginTop", "marginBottom"],
  marginHorizontal: ["marginLeft", "marginRight"],
}

/** One node-id's override from `TemplateSettings.nodes` — see the Block Settings tab. */
type NodeOverride = { hidden?: boolean; styles?: string | string[]; text?: string }

function nodeOverride(
  id: string | undefined,
  settings: Record<string, unknown> | undefined
): NodeOverride | undefined {
  if (!id) return undefined
  const nodes = settings?.nodes as Record<string, NodeOverride> | undefined
  return nodes?.[id]
}

/** Falsy for `if`, empty arrays, empty strings, etc. */
function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

/**
 * Convert a style object from points to pixels.
 * K = 96/72 scales lengths; UNITLESS values pass through unchanged.
 * String values pass through unscaled.
 */
function scaleStyle(style: Style | undefined): CSSProperties | undefined {
  if (!style) return undefined

  const result: CSSProperties = {}
  for (const [rawKey, value] of Object.entries(style)) {
    const keys = SHORTHAND[rawKey] ?? [rawKey as keyof CSSProperties]
    for (const key of keys) {
      if (typeof value === "string") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key] = value as any
      } else if (typeof value === "number") {
        if (UNITLESS.has(rawKey)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result[key] = value as any
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          result[key] = `${value * K}px` as any
        }
      }
    }
  }
  return result
}

function renderNode(
  node: TemplateNode,
  scope: TemplateScope,
  data: ResumeDocument,
  blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
  expanding: Set<string>
): ReactNode {
  // Structural dispatch per spec 07 order (repeat → block → if → join → else ElementNode)
  if ("repeat" in node) {
    return renderRepeat(node as RepeatNode, scope, data, blocks, styles, settings, expanding)
  }
  if ("block" in node) {
    return renderBlockInstance(node as BlockInstanceNode, scope, data, blocks, styles, settings, expanding)
  }
  if ("if" in node) {
    return renderIf(node as IfNode, scope, data, blocks, styles, settings, expanding)
  }
  if ("join" in node) {
    return renderJoin(node as JoinNode, scope, data, blocks, styles, settings, expanding)
  }

  // ElementNode (default)
  return renderElement(node as ElementNode, scope, data, blocks, styles, settings, expanding)
}

function renderElement(
  node: ElementNode,
  scope: TemplateScope,
  data: ResumeDocument,
  blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
  expanding: Set<string>
): ReactNode {
  const override = nodeOverride(node.id, settings)
  if (override?.hidden) {
    return null
  }
  if (override?.styles !== undefined || override?.text !== undefined) {
    node = {
      ...node,
      ...(override.styles !== undefined ? { styles: override.styles } : {}),
      ...(override.text !== undefined ? { text: override.text } : {}),
    }
  }

  const tag = node.tag
  const resolvedStyle = resolveStyleObject(
    node.styles,
    styles,
    node.style,
    (settings?.styles as Record<string, unknown>) ?? undefined
  )
  const cssStyle = scaleStyle(resolvedStyle)

  // Text content
  if (node.text) {
    const textValue = resolveValue(node.text, scope, data)
    if (isEmpty(textValue)) {
      return null
    }
    const content = String(textValue)

    if (node.attrs?.href) {
      const href = resolveValue(node.attrs.href, scope, data)
      if (!isEmpty(href)) {
        return (
          <a href={String(href)} style={cssStyle}>
            {content}
          </a>
        )
      }
    }

    if (!tag) {
      // No wrapping element requested — but a style still needs somewhere to
      // live, so fall back to a bare `<span>` rather than silently dropping it.
      return cssStyle ? <span style={cssStyle}>{content}</span> : content
    }

    return createElement(tag, { style: cssStyle }, content)
  }

  // Children
  if (node.children) {
    const rendered = node.children.map((child) =>
      renderNode(child, scope, data, blocks, styles, settings, expanding)
    )
    const anyVisible = rendered.some((r) => r !== null && r !== undefined)

    if (!anyVisible) {
      return null
    }

    return createElement(tag ?? "div", { style: cssStyle }, ...rendered)
  }

  // Empty element
  return createElement(tag ?? "div", { style: cssStyle })
}

function renderRepeat(
  node: RepeatNode,
  scope: TemplateScope,
  data: ResumeDocument,
  blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
  expanding: Set<string>
): ReactNode {
  const { repeat } = node
  const override = nodeOverride(repeat.id, settings)
  if (override?.hidden) {
    return null
  }
  const repeatStyles = override?.styles !== undefined ? override.styles : repeat.styles

  const arrayValue = resolveValue(repeat.for, scope, data)
  if (!Array.isArray(arrayValue) || arrayValue.length === 0) {
    return null
  }

  let candidates = arrayValue as unknown[]

  // Filter
  if (repeat.filter) {
    const { field, op, value } = repeat.filter
    candidates = candidates.filter((item) => {
      const fieldValue = resolveValue(field, { item }, data)
      const included = value.includes(String(fieldValue))
      return op === "in" ? included : !included
    })
  }

  // Sort
  if (repeat.sort) {
    const { field, priority } = repeat.sort
    const rank = (item: unknown) => {
      const index = priority.indexOf(
        String(resolveValue(field, { item }, data))
      )
      return index === -1 ? priority.length : index
    }
    candidates = [...candidates].sort((a, b) => rank(a) - rank(b))
  }

  if (candidates.length === 0) {
    return null
  }

  const tag = repeat.tag ?? "div"

  if (repeat.merge) {
    const { text, separator = ", ", end = "" } = repeat.merge
    const parts = candidates
      .map((item, index) => resolveValue(text, { item, index }, data))
      .filter((value) => !isEmpty(value))
      .map((value) => String(value))

    if (parts.length === 0) {
      return null
    }

    const resolvedStyle = resolveStyleObject(
      repeatStyles,
      styles,
      repeat.style,
      (settings?.styles as Record<string, unknown>) ?? undefined
    )
    const cssStyle = scaleStyle(resolvedStyle)

    return createElement(tag, { style: cssStyle }, parts.join(separator) + end)
  }

  const rendered = candidates.map((item, index) => {
    // Resolve `as` mapping against {item, index}
    const itemScope: TemplateScope = {}
    if (repeat.as) {
      itemScope.prop = {}
      for (const [key, pathValue] of Object.entries(repeat.as)) {
        const resolved = resolveValue(
          pathValue,
          { item, index },
          data
        )
        itemScope.prop![key] = resolved
      }
    }

    // Render the block with the mapped prop scope
    const blockDef = blocks[repeat.block]
    if (!blockDef) {
      throw new Error(`TemplateNodeRenderer: unknown block "${repeat.block}".`)
    }

    const nextExpanding = new Set(expanding)
    nextExpanding.add(repeat.block)

    return (
      <Fragment key={index}>
        {renderNode(
          blockDef.node,
          itemScope,
          data,
          blocks,
          styles,
          settings,
          nextExpanding
        )}
      </Fragment>
    )
  })

  const resolvedStyle = resolveStyleObject(
    repeatStyles,
    styles,
    repeat.style,
    (settings?.styles as Record<string, unknown>) ?? undefined
  )
  const cssStyle = scaleStyle(resolvedStyle)

  const interleaved: ReactNode[] = []
  rendered.forEach((child, index) => {
    if (index > 0 && repeat.separator) {
      interleaved.push(
        <Fragment key={`sep-${index}`}>
          {renderNode(
            repeat.separator,
            scope,
            data,
            blocks,
            styles,
            settings,
            expanding
          )}
        </Fragment>
      )
    }
    interleaved.push(child)
  })

  return createElement(tag, { style: cssStyle }, interleaved)
}

function renderBlockInstance(
  node: BlockInstanceNode,
  scope: TemplateScope,
  data: ResumeDocument,
  blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
  expanding: Set<string>
): ReactNode {
  const blockDef = blocks[node.block]
  if (!blockDef) {
    throw new Error(`TemplateNodeRenderer: unknown block "${node.block}".`)
  }
  if (expanding.has(node.block)) {
    throw new Error(
      `TemplateNodeRenderer: cyclic block instantiation of "${node.block}".`
    )
  }

  const override = nodeOverride(node.id, settings)
  if (override?.hidden) {
    return null
  }

  // Resolve props and create new scope
  const propScope: Record<string, unknown> = {}
  if (node.props) {
    for (const [key, pathValue] of Object.entries(node.props)) {
      propScope[key] = resolveValue(pathValue, scope, data)
    }
  }

  const nextScope: TemplateScope = { prop: propScope }
  const nextExpanding = new Set(expanding)
  nextExpanding.add(node.block)

  // A style/text override targets this instantiation site specifically, so
  // it patches the block's own root node rather than the (styleless)
  // BlockInstanceNode wrapper — e.g. overriding the h2 `sectionHeading`
  // renders with, not some wrapper around it.
  let rootNode = blockDef.node
  if (override?.styles !== undefined || override?.text !== undefined) {
    rootNode = {
      ...rootNode,
      ...(override.styles !== undefined ? { styles: override.styles } : {}),
      ...(override.text !== undefined ? { text: override.text } : {}),
    } as TemplateNode
  }

  // Render the block's node tree
  return renderNode(
    rootNode,
    nextScope,
    data,
    blocks,
    styles,
    settings,
    nextExpanding
  )
}

function renderIf(
  node: IfNode,
  scope: TemplateScope,
  data: ResumeDocument,
  blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
  expanding: Set<string>
): ReactNode {
  const value = resolveValue(node.if, scope, data)

  let condition: boolean
  if (node.equals !== undefined) {
    condition = !isEmpty(value) && String(value) === node.equals
  } else if (node.in !== undefined) {
    condition = !isEmpty(value) && node.in.includes(String(value))
  } else {
    condition = !isEmpty(value)
  }

  if (condition) {
    return renderNode(
      node.then,
      scope,
      data,
      blocks,
      styles,
      settings,
      expanding
    )
  }
  return node.else
    ? renderNode(node.else, scope, data, blocks, styles, settings, expanding)
    : null
}

function renderJoin(
  node: JoinNode,
  scope: TemplateScope,
  data: ResumeDocument,
  blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
  expanding: Set<string>
): ReactNode {
  const { join } = node
  const rendered = join.parts
    .map((part) =>
      renderNode(part, scope, data, blocks, styles, settings, expanding)
    )
    .filter((r) => r !== null && r !== undefined)

  if (rendered.length === 0) {
    return null
  }

  const interleaved: ReactNode[] = []
  rendered.forEach((part, index) => {
    if (index > 0) {
      interleaved.push(
        <Fragment key={`sep-${index}`}>{join.separator}</Fragment>
      )
    }
    interleaved.push(<Fragment key={index}>{part}</Fragment>)
  })

  const resolvedStyle = resolveStyleObject(
    join.styles,
    styles,
    join.style,
    (settings?.styles as Record<string, unknown>) ?? undefined
  )
  const cssStyle = scaleStyle(resolvedStyle)

  return cssStyle ? <span style={cssStyle}>{interleaved}</span> : interleaved
}

/**
 * Top-level export. Reads page geometry from `definition.page` instead of
 * hardcoding it. Scales all resolved styles by K = 96/72 (points to pixels).
 */
export function TemplateNodeRenderer({
  definition,
  context,
  settings,
  className,
  ref
}: {
  definition: TemplateDefinition
  context: ResumeDocument
  settings?: TemplateSettings
  className?: string
  ref?: React.Ref<HTMLDivElement>
}) {
  // Per-CV overrides (Page tab) shallow-merged onto the template's own page
  // config — same "settings patch onto template base" pattern styles use.
  const page: PageConfig = { ...definition.page, ...settings?.page }
  const {
    size,
    orientation = "portrait",
    fontFamily = "Helvetica",
    fontSize = 10,
    lineHeight = 1.4,
    color = "#111827",
  } = page

  // Page dimensions in points; scale to pixels for DOM
  const pageSizeMap: Record<string, { width: number; height: number }> = {
    A4: { width: 595.28, height: 841.89 },
    LETTER: { width: 612, height: 792 },
    LEGAL: { width: 612, height: 1008 },
  }

  const pageDim = pageSizeMap[size]
  const [pageWidthPt, pageHeightPt] =
    orientation === "landscape"
      ? [pageDim.height, pageDim.width]
      : [pageDim.width, pageDim.height]
  const pageWidthPx = Math.round(pageWidthPt * K)
  const pageHeightPx = Math.round(pageHeightPt * K)
  const pageMarginPx = Math.round((page.margin ?? 0) * K)

  return (
    <div

      data-resume-page
      className={cn(
        "bg-white text-neutral-900",
        "print:min-h-0 print:w-full print:shadow-none",
        className
      )}
      style={{
        width: `${pageWidthPx}px`,
        minHeight: `${pageHeightPx}px`,
        padding: `${pageMarginPx}px`
      }}
    >
      <div ref={ref} style={{
        fontFamily,
        fontSize: `${fontSize * K}px`,
        lineHeight,
        color,
      }}>
        {renderNode(
          definition.root,
          {},
          context,
          definition.blocks,
          definition.styles,
          settings,
          new Set()
        )}
      </div>
    </div>
  )
}
