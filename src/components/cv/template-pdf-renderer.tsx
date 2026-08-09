/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Document,
  Font,
  Page,
  Text,
  View,
} from "@react-pdf/renderer"
import { cloneElement, useMemo } from "react"
import type { ReactElement } from "react"

import {
  resolveValue,
  resolveStyleObject,
  type TemplateScope,
} from "@/lib/cv-template-core"
import type {
  BlockDef,
  ElementNode,
  PageNumberNode,
  TemplateDefinition,
  TemplateNode,
} from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/persona"

/**
 * PDF backend renderer for spec 07 CV templates using @react-pdf/renderer.
 * Simplified implementation focused on correctness.
 */

// Disable hyphenation so PDF word-wrap matches DOM preview
Font.registerHyphenationCallback((word) => [word])

const TEXT_TAGS = new Set(["span", "p", "h1", "h2", "h3", "a", "li"])

/**
 * react-pdf multiplies `lineHeight` by a Text node's OWN `fontSize` — and
 * defaults that to 18 when the node has no explicit `fontSize` of its own,
 * even though the *rendered* size correctly inherits a smaller one from an
 * ancestor. Relying on cascade (as the DOM backend does) therefore produces
 * wrong — and inconsistent — line heights and can visually overlap adjacent
 * boxes. The fix: track the effective fontSize/lineHeight ourselves as we
 * walk the tree and stamp both explicitly onto every emitted <Text>, instead
 * of setting them once on <Page> and hoping they cascade.
 */
type Inherited = { fontSize: number; lineHeight: number }

function withKey(node: any, key: React.Key): any {
  return node && typeof node === "object" && "type" in node
    ? cloneElement(node, { key })
    : node
}

function cleanStyle(style: any): any {
  if (!style) return undefined
  const result: any = {}
  const unsupported = new Set([
    "boxShadow", "gridTemplateColumns", "gridTemplateRows", "gridTemplateAreas",
    "cursor", "transition", "boxSizing", "appearance", "listStyle", "listStyleType",
    "outline", "whiteSpace", "float", "content",
  ])
  for (const [key, value] of Object.entries(style)) {
    if (unsupported.has(key)) continue
    const finalKey = key === "background" ? "backgroundColor" : key
    result[finalKey] = value
  }
  return result
}

/** Effective fontSize/lineHeight for this node, given what it resolves to and what it inherits. */
function effInherited(resolvedStyle: any, inh: Inherited): Inherited {
  const fontSize = typeof resolvedStyle.fontSize === "number" ? resolvedStyle.fontSize : inh.fontSize
  const lineHeight = resolvedStyle.lineHeight != null ? resolvedStyle.lineHeight : inh.lineHeight
  return { fontSize, lineHeight }
}

function renderNode(
  node: TemplateNode,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>,
  inh: Inherited
): any {
  if ("pageNumber" in node) return renderPageNumber(node as any, inh)
  if ("repeat" in node) return renderRepeat(node as any, scope, data, definition, blocks, expanding, inh)
  if ("block" in node) return renderBlockInstance(node as any, scope, data, definition, blocks, expanding, inh)
  if ("if" in node) return renderIf(node as any, scope, data, definition, blocks, expanding, inh)
  if ("join" in node) return renderJoin(node as any, scope, data, definition, blocks, expanding, inh)
  return renderElement(node as any, scope, data, definition, blocks, expanding, inh)
}

function renderPageNumber(node: PageNumberNode, inh: Inherited): any {
  const format = node.format || "{n} / {t}"
  const text = format.replace("{n}", "1").replace("{t}", "1")
  const resolvedStyle = node.style ?? {}
  const { fontSize } = effInherited(resolvedStyle, inh)
  // No lineHeight here — combined with the `render` callback pattern
  // elsewhere it can drop the node from layout; fontSize alone is enough
  // to pin the correct multiplier base for any Text that measures it.
  const style = cleanStyle({ ...resolvedStyle, fontSize })
  return <Text style={style}>{text}</Text>
}

function renderElement(
  node: ElementNode,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>,
  inh: Inherited
): any {
  const tag = node.tag ?? "div"
  const resolvedStyle = resolveStyleObject(node.styles, definition.styles, node.style)
  const isText = TEXT_TAGS.has(tag)
  const { fontSize, lineHeight } = effInherited(resolvedStyle, inh)
  const childInh: Inherited = { fontSize, lineHeight }
  // Leaf `{ text: ... }` nodes always render as <Text> regardless of `tag`
  // (most default to "div"), so the fontSize/lineHeight stamp must apply
  // there too — not just when `isText(tag)` picked the Text branch below.
  const textStyle = cleanStyle({ ...resolvedStyle, fontSize, lineHeight })
  const viewStyle = cleanStyle(resolvedStyle)

  if (node.text) {
    const textValue = resolveValue(node.text, scope, data)
    if (!textValue) return null
    return <Text style={textStyle}>{String(textValue)}</Text>
  }

  if (node.children) {
    const rendered = node.children
      .map((child) => renderNode(child, scope, data, definition, blocks, expanding, childInh))
      .filter((r) => r !== null)
      .map((r, i) => withKey(r, i))
    if (!rendered.length) return null
    return isText ?
      <Text style={textStyle}>{rendered}</Text> :
      <View style={viewStyle}>{rendered}</View>
  }

  return isText ?
    <Text style={textStyle} /> :
    <View style={viewStyle} />
}

function renderRepeat(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>,
  inh: Inherited
): any {
  const { repeat } = node
  const arrayValue = resolveValue(repeat.for, scope, data)
  if (!Array.isArray(arrayValue) || !arrayValue.length) return null

  let candidates = [...arrayValue]
  if (repeat.filter) {
    const { field, op, value } = repeat.filter
    candidates = candidates.filter((item) => {
      const fieldValue = resolveValue(field, { item }, data)
      const included = value.includes(String(fieldValue))
      return op === "in" ? included : !included
    })
  }
  if (repeat.sort) {
    const { field, priority } = repeat.sort
    candidates.sort((a, b) => {
      const aIndex = priority.indexOf(String(resolveValue(field, { item: a }, data)))
      const bIndex = priority.indexOf(String(resolveValue(field, { item: b }, data)))
      return (aIndex === -1 ? priority.length : aIndex) - (bIndex === -1 ? priority.length : bIndex)
    })
  }
  if (!candidates.length) return null

  const tag = repeat.tag ?? "div"
  const resolvedStyle = resolveStyleObject(repeat.styles, definition.styles, repeat.style)
  const isText = TEXT_TAGS.has(tag)
  const { fontSize, lineHeight } = effInherited(resolvedStyle, inh)
  const childInh: Inherited = { fontSize, lineHeight }
  const cleanedStyle = cleanStyle(
    isText ? { ...resolvedStyle, fontSize, lineHeight } : resolvedStyle
  )

  const rendered = candidates.map((item, index) => {
    const itemScope: TemplateScope = {}
    if (repeat.as) {
      itemScope.prop = {}
      for (const [key, pathValue] of Object.entries(repeat.as)) {
        itemScope.prop![key] = resolveValue(pathValue, { item, index }, data)
      }
    }
    const blockDef = blocks[repeat.block]
    if (!blockDef) throw new Error(`Unknown block "${repeat.block}"`)
    const nextExpanding = new Set(expanding)
    nextExpanding.add(repeat.block)
    return renderNode(blockDef.node, itemScope, data, definition, blocks, nextExpanding, childInh)
  }).filter((r) => r !== null)

  if (!rendered.length) return null
  const interleaved: any[] = []
  rendered.forEach((child, index) => {
    if (index > 0 && repeat.separator) {
      interleaved.push(
        withKey(
          renderNode(repeat.separator, scope, data, definition, blocks, expanding, childInh),
          `sep-${index}`
        )
      )
    }
    interleaved.push(withKey(child, index))
  })

  return isText ?
    <Text style={cleanedStyle}>{interleaved}</Text> :
    <View style={cleanedStyle}>{interleaved}</View>
}

function renderBlockInstance(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>,
  inh: Inherited
): any {
  const blockDef = blocks[node.block]
  if (!blockDef) throw new Error(`Unknown block "${node.block}"`)
  if (expanding.has(node.block)) throw new Error(`Cyclic block "${node.block}"`)

  const propScope: any = {}
  if (node.props) {
    for (const [key, pathValue] of Object.entries(node.props)) {
      propScope[key] = resolveValue(pathValue, scope, data)
    }
  }

  const nextScope: TemplateScope = { prop: propScope }
  const nextExpanding = new Set(expanding)
  nextExpanding.add(node.block)

  return renderNode(blockDef.node, nextScope, data, definition, blocks, nextExpanding, inh)
}

function renderIf(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>,
  inh: Inherited
): any {
  const value = resolveValue(node.if, scope, data)
  let condition = !(!value || value === "" || (Array.isArray(value) && !value.length))
  if (node.equals !== undefined) {
    condition = condition && String(value) === node.equals
  } else if (node.in !== undefined) {
    condition = condition && node.in.includes(String(value))
  }
  if (condition) {
    return renderNode(node.then, scope, data, definition, blocks, expanding, inh)
  }
  return node.else ? renderNode(node.else, scope, data, definition, blocks, expanding, inh) : null
}

function renderJoin(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>,
  inh: Inherited
): any {
  const { join } = node
  const rendered = join.parts
    .map((part: any) => renderNode(part, scope, data, definition, blocks, expanding, inh))
    .filter((r: any) => r !== null)
  if (!rendered.length) return null

  const resolvedStyle = resolveStyleObject(join.styles, definition.styles, join.style)
  const { fontSize, lineHeight } = effInherited(resolvedStyle, inh)
  const cleanedStyle = cleanStyle({ ...resolvedStyle, fontSize, lineHeight })

  const interleaved: any[] = []
  rendered.forEach((part: any, index: number) => {
    if (index > 0) {
      interleaved.push(
        <Text key={`sep-${index}`} style={{ fontSize, lineHeight }}>
          {join.separator}
        </Text>
      )
    }
    interleaved.push(withKey(part, index))
  })
  return <Text style={cleanedStyle}>{interleaved}</Text>
}

export function buildPdfDocument(
  definition: TemplateDefinition,
  document: ResumeDocument
): ReactElement {
  const {
    page: { size = "A4", fontFamily = "Helvetica", fontSize = 10, lineHeight = 1.4, color = "#111827" },
  } = definition

  // lineHeight is deliberately NOT set on <Page> — see the Inherited comment
  // above. We thread it down manually instead of relying on cascade.
  const inh: Inherited = { fontSize, lineHeight }
  const root = renderNode(definition.root, {}, document, definition, definition.blocks, new Set(), inh)

  return (
    <Document title={document.personaName}>
      <Page
        size={size as any}
        style={{ fontFamily, fontSize, color } as any}
      >
        {root}
      </Page>
    </Document>
  )
}

export function usePdfDocument(
  definition: TemplateDefinition,
  document: ResumeDocument
): ReactElement {
  return useMemo(
    () => buildPdfDocument(definition, document),
    [definition, document]
  )
}
