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
  PageNumberNode,
  RepeatNode,
  TemplateDefinition,
  TemplateNode,
} from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/persona"

/**
 * DOM backend renderer for spec 07 CV templates.
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
  for (const [key, value] of Object.entries(style)) {
    if (typeof value === "string") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result[key as keyof CSSProperties] = value as any
    } else if (typeof value === "number") {
      if (UNITLESS.has(key)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key as keyof CSSProperties] = value as any
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result[key as keyof CSSProperties] = `${value * K}px` as any
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
  // Structural dispatch per spec 07 order (pageNumber → repeat → block → if → join → else ElementNode)
  if ("pageNumber" in node) {
    return renderPageNumber(node as PageNumberNode, scope, data, blocks, styles, settings)
  }
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

function renderPageNumber(
  node: PageNumberNode,
  _scope: TemplateScope,
  _data: ResumeDocument,
  _blocks: Record<string, BlockDef>,
  styles: Record<string, Style>,
  settings: Record<string, unknown> | undefined,
): ReactNode {
  // DOM backend is static (no real page numbers in preview)
  const format = node.format || "{n} / {t}"
  const text = format.replace("{n}", "1").replace("{t}", "1")

  const resolvedStyle = resolveStyleObject(
    node.styles,
    styles,
    node.style,
    (settings?.styles as Record<string, unknown>) ?? undefined
  )
  const cssStyle = scaleStyle(resolvedStyle)

  if (cssStyle) {
    return <span style={cssStyle}>{text}</span>
  }
  return text
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
  // Check if hidden by settings
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (node.id && (settings?.nodes as any)?.[node.id]?.hidden) {
    return null
  }

  const tag = node.tag ?? "div"
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

    if (tag === "div" && !cssStyle) {
      return content
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

    return createElement(tag, { style: cssStyle }, ...rendered)
  }

  // Empty element
  return createElement(tag, { style: cssStyle })
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
    repeat.styles,
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

  // Render the block's node tree
  return renderNode(
    blockDef.node,
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
}: {
  definition: TemplateDefinition
  context: ResumeDocument
  settings?: Record<string, unknown>
  className?: string
}) {
  const {
    page: {
      size,
      fontFamily = "Helvetica",
      fontSize = 10,
      lineHeight = 1.4,
      color = "#111827",
    },
  } = definition

  // Page dimensions in points; scale to pixels for DOM
  const pageSizeMap: Record<string, { width: number; height: number }> = {
    A4: { width: 595.28, height: 841.89 },
    LETTER: { width: 612, height: 792 },
    LEGAL: { width: 612, height: 1008 },
  }

  const pageDim = pageSizeMap[size]
  const pageWidthPx = Math.round(pageDim.width * K)
  const pageHeightPx = Math.round(pageDim.height * K)

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
        fontFamily,
        fontSize: `${fontSize * K}px`,
        lineHeight,
        color,
      }}
    >
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
  )
}
