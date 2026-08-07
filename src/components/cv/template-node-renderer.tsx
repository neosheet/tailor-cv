import { createElement, Fragment, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import type {
  BoxNode,
  IfNode,
  JoinNode,
  RefNode,
  RepeatNode,
  TemplateDefinition,
  TemplateNode,
  TextNode,
} from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/persona"

/**
 * Interprets a `TemplateDefinition` (docs/specs/05-cv-template-format.md)
 * against a `ResumeDocument` and returns a React tree. Replaces the
 * `component` field `CvTemplate` carried before — one generic renderer for
 * every template, built-in or (later) user-authored.
 */

type Scope = Record<string, unknown>

/** Falsy for `if`, a bare `text`/`repeat` with an empty bound value, and `href`. */
function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

/** Name-based resolution: the first segment is looked up on `scope` by name. */
function resolveBind(path: string, scope: Scope): unknown {
  const segments = path.split(".")
  let current: unknown = scope[segments[0]]
  for (const segment of segments.slice(1)) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Scope)[segment]
  }
  return current
}

function renderNode(
  node: TemplateNode,
  scope: Scope,
  blocks: Record<string, TemplateNode>,
  expanding: Set<string>
): ReactNode {
  switch (node.type) {
    case "box":
      return renderBox(node, scope, blocks, expanding)
    case "text":
      return renderText(node, scope)
    case "join":
      return renderJoin(node, scope, blocks, expanding)
    case "repeat":
      return renderRepeat(node, scope, blocks, expanding)
    case "if":
      return renderIf(node, scope, blocks, expanding)
    case "ref":
      return renderRef(node, scope, blocks, expanding)
  }
}

/**
 * Empty propagation: a `box` whose `children` array was given renders `null`
 * when every rendered child comes back `null` — recursively, since a `box`
 * wrapping only an empty `join`/`repeat` is itself empty. A `box` with no
 * `children` key at all still renders as a normal, if pointless, empty
 * element.
 */
function renderBox(
  node: BoxNode,
  scope: Scope,
  blocks: Record<string, TemplateNode>,
  expanding: Set<string>
): ReactNode {
  const tag = node.tag ?? "div"
  if (!node.children) {
    return createElement(tag, { style: node.style })
  }

  const rendered = node.children.map((child) =>
    renderNode(child, scope, blocks, expanding)
  )
  const anyVisible = rendered.some((r) => r !== null && r !== undefined)
  if (!anyVisible) {
    return null
  }

  return createElement(tag, { style: node.style }, ...rendered)
}

function renderText(node: TextNode, scope: Scope): ReactNode {
  const text = "bind" in node ? resolveBind(node.bind, scope) : node.literal
  if (isEmpty(text)) {
    return null
  }
  const content = String(text)

  if (node.href) {
    const href = resolveBind(node.href, scope)
    if (!isEmpty(href)) {
      return (
        <a href={String(href)} style={node.style}>
          {content}
        </a>
      )
    }
  }

  if (node.style) {
    return <span style={node.style}>{content}</span>
  }

  return content
}

/** A fixed set of optional parts, joined by a literal separator, blanks dropped. */
function renderJoin(
  node: JoinNode,
  scope: Scope,
  blocks: Record<string, TemplateNode>,
  expanding: Set<string>
): ReactNode {
  const rendered = node.parts
    .map((part) => renderNode(part, scope, blocks, expanding))
    .filter((r) => r !== null && r !== undefined)

  if (rendered.length === 0) {
    return null
  }

  const interleaved: ReactNode[] = []
  rendered.forEach((part, index) => {
    if (index > 0) {
      interleaved.push(
        <Fragment key={`sep-${index}`}>{node.separator}</Fragment>
      )
    }
    interleaved.push(<Fragment key={index}>{part}</Fragment>)
  })

  return node.style ? <span style={node.style}>{interleaved}</span> : interleaved
}

/**
 * `filter`/`sort` run against the raw candidate item, before it's bound to
 * `as` — so `field` is a path relative to the item itself, not `entry.field`.
 */
function renderRepeat(
  node: RepeatNode,
  scope: Scope,
  blocks: Record<string, TemplateNode>,
  expanding: Set<string>
): ReactNode {
  const raw = resolveBind(node.bind, scope)
  if (!Array.isArray(raw) || raw.length === 0) {
    return null
  }

  let candidates = raw as unknown[]

  if (node.filter) {
    const { field, op, value } = node.filter
    candidates = candidates.filter((item) => {
      const fieldValue = resolveBind(field, item as Scope)
      const included = value.includes(String(fieldValue))
      return op === "in" ? included : !included
    })
  }

  if (node.sort) {
    const { field, priority } = node.sort
    const rank = (item: unknown) => {
      const index = priority.indexOf(String(resolveBind(field, item as Scope)))
      return index === -1 ? priority.length : index
    }
    candidates = [...candidates].sort((a, b) => rank(a) - rank(b))
  }

  if (candidates.length === 0) {
    return null
  }

  const tag = node.tag ?? "div"
  const rendered = candidates.map((item, index) => {
    const itemScope: Scope = { ...scope, [node.as]: item }
    return (
      <Fragment key={index}>
        {renderNode(node.child, itemScope, blocks, expanding)}
      </Fragment>
    )
  })

  const interleaved: ReactNode[] = []
  rendered.forEach((child, index) => {
    if (index > 0 && node.separator) {
      interleaved.push(
        <Fragment key={`sep-${index}`}>
          {renderNode(node.separator, scope, blocks, expanding)}
        </Fragment>
      )
    }
    interleaved.push(child)
  })

  return createElement(tag, { style: node.style }, interleaved)
}

/** Defaults to truthy/falsy; `equals`/`in` compare a resolved string. */
function renderIf(
  node: IfNode,
  scope: Scope,
  blocks: Record<string, TemplateNode>,
  expanding: Set<string>
): ReactNode {
  const value = resolveBind(node.bind, scope)

  let condition: boolean
  if (node.equals !== undefined) {
    condition = !isEmpty(value) && String(value) === node.equals
  } else if (node.in !== undefined) {
    condition = !isEmpty(value) && node.in.includes(String(value))
  } else {
    condition = !isEmpty(value)
  }

  if (condition) {
    return renderNode(node.then, scope, blocks, expanding)
  }
  return node.else ? renderNode(node.else, scope, blocks, expanding) : null
}

/**
 * Instantiates a named block, extending scope per `with`. Guards against a
 * `ref` cycle — `blocks` is fully data-driven, so a typo'd or malicious loop
 * must fail loudly rather than hang the renderer.
 */
function renderRef(
  node: RefNode,
  scope: Scope,
  blocks: Record<string, TemplateNode>,
  expanding: Set<string>
): ReactNode {
  const target = blocks[node.block]
  if (!target) {
    throw new Error(`TemplateNodeRenderer: unknown block "${node.block}".`)
  }
  if (expanding.has(node.block)) {
    throw new Error(
      `TemplateNodeRenderer: cyclic ref to block "${node.block}".`
    )
  }

  const nextScope: Scope = { ...scope }
  if (node.with) {
    for (const [key, path] of Object.entries(node.with)) {
      nextScope[key] = resolveBind(path, scope)
    }
  }

  const nextExpanding = new Set(expanding)
  nextExpanding.add(node.block)

  return renderNode(target, nextScope, blocks, nextExpanding)
}

/**
 * Top-level export. Wraps `definition.root` in the same fixed A4 page
 * geometry `ResumePage` used — page *chrome*, not template content, so it
 * stays a plain component rather than data (spec 05).
 */
export function TemplateNodeRenderer({
  definition,
  context,
  className,
}: {
  definition: TemplateDefinition
  context: ResumeDocument
  className?: string
}) {
  return (
    <div
      data-resume-page
      className={cn(
        "min-h-[1123px] w-[794px] bg-white text-neutral-900",
        "print:min-h-0 print:w-full print:shadow-none",
        className
      )}
    >
      {renderNode(
        definition.root,
        context as unknown as Scope,
        definition.blocks,
        new Set()
      )}
    </div>
  )
}
