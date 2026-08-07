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

function renderNode(
  node: TemplateNode,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>
): any {
  if ("pageNumber" in node) return renderPageNumber(node as any)
  if ("repeat" in node) return renderRepeat(node as any, scope, data, definition, blocks, expanding)
  if ("block" in node) return renderBlockInstance(node as any, scope, data, definition, blocks, expanding)
  if ("if" in node) return renderIf(node as any, scope, data, definition, blocks, expanding)
  if ("join" in node) return renderJoin(node as any, scope, data, definition, blocks, expanding)
  return renderElement(node as any, scope, data, definition, blocks, expanding)
}

function renderPageNumber(node: PageNumberNode): any {
  const format = node.format || "{n} / {t}"
  const text = format.replace("{n}", "1").replace("{t}", "1")
  const style = cleanStyle(node.style)
  if (style) delete style.lineHeight // react-pdf quirk
  return <Text style={style}>{text}</Text>
}

function renderElement(
  node: ElementNode,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>
): any {
  const tag = node.tag ?? "div"
  const resolvedStyle = resolveStyleObject(node.styles, definition.styles, node.style)
  const cleanedStyle = cleanStyle(resolvedStyle)

  if (node.text) {
    const textValue = resolveValue(node.text, scope, data)
    if (!textValue) return null
    return <Text style={cleanedStyle}>{String(textValue)}</Text>
  }

  if (node.children) {
    const rendered = node.children
      .map((child) => renderNode(child, scope, data, definition, blocks, expanding))
      .filter((r) => r !== null)
      .map((r, i) => withKey(r, i))
    if (!rendered.length) return null
    return TEXT_TAGS.has(tag) ?
      <Text style={cleanedStyle}>{rendered}</Text> :
      <View style={cleanedStyle}>{rendered}</View>
  }

  return TEXT_TAGS.has(tag) ?
    <Text style={cleanedStyle} /> :
    <View style={cleanedStyle} />
}

function renderRepeat(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>
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
  const cleanedStyle = cleanStyle(resolvedStyle)

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
    return renderNode(blockDef.node, itemScope, data, definition, blocks, nextExpanding)
  }).filter((r) => r !== null)

  if (!rendered.length) return null
  const interleaved: any[] = []
  rendered.forEach((child, index) => {
    if (index > 0 && repeat.separator) {
      interleaved.push(
        withKey(
          renderNode(repeat.separator, scope, data, definition, blocks, expanding),
          `sep-${index}`
        )
      )
    }
    interleaved.push(withKey(child, index))
  })

  return TEXT_TAGS.has(tag) ?
    <Text style={cleanedStyle}>{interleaved}</Text> :
    <View style={cleanedStyle}>{interleaved}</View>
}

function renderBlockInstance(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>
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

  return renderNode(blockDef.node, nextScope, data, definition, blocks, nextExpanding)
}

function renderIf(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>
): any {
  const value = resolveValue(node.if, scope, data)
  let condition = !(!value || value === "" || (Array.isArray(value) && !value.length))
  if (node.equals !== undefined) {
    condition = condition && String(value) === node.equals
  } else if (node.in !== undefined) {
    condition = condition && node.in.includes(String(value))
  }
  if (condition) {
    return renderNode(node.then, scope, data, definition, blocks, expanding)
  }
  return node.else ? renderNode(node.else, scope, data, definition, blocks, expanding) : null
}

function renderJoin(
  node: any,
  scope: TemplateScope,
  data: ResumeDocument,
  definition: TemplateDefinition,
  blocks: Record<string, BlockDef>,
  expanding: Set<string>
): any {
  const { join } = node
  const rendered = join.parts
    .map((part: any) => renderNode(part, scope, data, definition, blocks, expanding))
    .filter((r: any) => r !== null)
  if (!rendered.length) return null

  const resolvedStyle = resolveStyleObject(join.styles, definition.styles, join.style)
  const cleanedStyle = cleanStyle(resolvedStyle)

  const interleaved: any[] = []
  rendered.forEach((part: any, index: number) => {
    if (index > 0) interleaved.push(<Text key={`sep-${index}`}>{join.separator}</Text>)
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

  const root = renderNode(definition.root, {}, document, definition, definition.blocks, new Set())

  return (
    <Document title={document.personaName}>
      <Page
        size={size as any}
        style={{ fontFamily, fontSize, lineHeight, color } as any}
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
