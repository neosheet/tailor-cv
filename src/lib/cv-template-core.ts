/**
 * Framework-free shared core for CV template rendering.
 * Mirrors json-ui/src/jsonui/core.js: scope/placeholder resolution and style flattening.
 * Imported by the DOM renderer (template-node-renderer.tsx).
 */

import type { ResumeDocument } from "@/lib/persona"
import type { BlockDef, TemplateDefinition, TemplateNode } from "@/lib/cv-template-schema"

/** Sigil-based scope: $data (document root), $prop (block props), $item/$index (repeat context). */
export type TemplateScope = {
  prop?: Record<string, unknown>
  item?: unknown
  index?: number
}

export type Style = Record<string, string | number>
export type StyleDef = Style & { extends?: string[] }

/** Matches one sigil token, e.g. `$data.foo.bar`, `$prop.x`, `$item`, `$index`. */
const SIGIL_TOKEN = /\$(?:data|prop|item|index)(?:\.[A-Za-z0-9_]+)*/g

/** Same pattern, anchored — used to tell "the whole string is one sigil" apart from "a sigil embedded in a literal". */
const WHOLE_SIGIL = new RegExp(`^${SIGIL_TOKEN.source}$`)

/** Resolve one sigil token (no surrounding literal text) against the scope. */
function resolveSigilToken(
  token: string,
  scope: TemplateScope,
  data: ResumeDocument
): unknown {
  const dotIndex = token.indexOf(".")
  if (dotIndex === -1) {
    // Bare sigils (no dot-path) resolve to the whole referenced value —
    // e.g. `$item` inside a `repeat.as` over a string[] like contactParts,
    // where there's no nested field to walk into.
    if (token === "$index") return scope.index
    if (token === "$item") return scope.item
    if (token === "$prop") return scope.prop
    if (token === "$data") return data
    return token
  }

  const root = token.slice(0, dotIndex)
  const path = token.slice(dotIndex + 1)

  let obj: unknown
  if (root === "$data") obj = data
  else if (root === "$prop") obj = scope.prop
  else if (root === "$item") obj = scope.item
  else return token // unrecognized root

  // Walk dot-path, undefined-safe (no throw)
  return getPath(obj, path)
}

/**
 * Resolve a single value against the template scope.
 * Implements spec 07's scope table (docs/specs/07:241-264):
 * - A string that is *entirely* one sigil resolves to that value's raw type
 *   (array/object/number included) — e.g. `repeat.for`, `if` conditions.
 * - A string with one or more sigils *embedded* in literal text is
 *   interpolated: each token is resolved and stringified in place, e.g.
 *   `"Hi, $data.name"` → `"Hi, Ada"`.
 * - $data.* → document root
 * - $prop.* → current block props
 * - $item.* → repeat loop item (pre-block scope only)
 * - $index → repeat loop index (pre-block scope only)
 * - Unrecognized roots, and strings with no sigil at all, return unchanged
 */
export function resolveValue(
  value: unknown,
  scope: TemplateScope,
  data: ResumeDocument
): unknown {
  if (typeof value !== "string") return value
  if (!value.includes("$")) return value

  if (WHOLE_SIGIL.test(value)) {
    return resolveSigilToken(value, scope, data)
  }

  SIGIL_TOKEN.lastIndex = 0
  if (!SIGIL_TOKEN.test(value)) {
    return value
  }

  SIGIL_TOKEN.lastIndex = 0
  return value.replace(SIGIL_TOKEN, (token) => {
    const resolved = resolveSigilToken(token, scope, data)
    return resolved === null || resolved === undefined ? "" : String(resolved)
  })
}

/**
 * Walk a dot-path (e.g., "foo.bar.baz") against an object.
 * Returns undefined if any intermediate is null/undefined.
 */
function getPath(obj: unknown, path: string): unknown {
  const keys = path.split(".")
  let current = obj
  for (const key of keys) {
    if (current == null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

/**
 * Resolve a style object against named style definitions.
 * Implements spec 07's resolution order (docs/specs/07:282-286):
 * 1. Flatten each referenced style name's extends chain (cycle-guarded)
 * 2. Shallow-merge settingsStyles[name] onto that name's flattened result
 * 3. Merge every referenced name left-to-right
 * 4. Merge the node's own inline style last (wins)
 */
export function resolveStyleObject(
  styleNames: string | string[] | undefined,
  styleDefs: Record<string, StyleDef>,
  inline: Style | undefined,
  settingsStyles?: Record<string, unknown>
): Style {
  const result: Style = {}
  const visited = new Set<string>() // cycle guard

  // 1. Resolve each named style (left-to-right)
  const names = Array.isArray(styleNames)
    ? styleNames
    : styleNames
      ? [styleNames]
      : []

  for (const name of names) {
    const flattened = flattenStyle(name, styleDefs, visited)
    Object.assign(result, flattened)

    // 2. Merge settings override for this name
    if (settingsStyles?.[name]) {
      Object.assign(result, settingsStyles[name])
    }
  }

  // 3. Merge inline style last (highest precedence)
  if (inline) {
    Object.assign(result, inline)
  }

  return result
}

/**
 * Recursively flatten a single style's extends chain, cycle-guarded.
 * Returns a merged Style object with all extends resolved.
 */
function flattenStyle(
  name: string,
  styleDefs: Record<string, StyleDef>,
  visited: Set<string>
): Style {
  if (visited.has(name)) return {} // cycle: revisited name returns empty, not infinite loop

  visited.add(name)
  const def = styleDefs[name]
  if (!def) return {}

  const result: Style = {}

  // Flatten extends first (if any)
  if (def.extends) {
    for (const extendName of def.extends) {
      const extendedStyle = flattenStyle(extendName, styleDefs, visited)
      Object.assign(result, extendedStyle)
    }
  }

  // Merge this style's own keys (on top of extends)
  for (const [key, value] of Object.entries(def)) {
    if (key !== "extends") {
      result[key] = value as string | number
    }
  }

  return result
}

/** One addressable node — an `id` a CV's Block Settings tab can target, and which block it's an instance of. */
export type BlockNodeId = { id: string; blockName: string; hasText: boolean }

/** Whether a node has a literal `text` field an override could replace. */
function hasLiteralText(node: TemplateNode | undefined): boolean {
  return Boolean(node) && "text" in (node as object) && typeof (node as { text?: unknown }).text === "string"
}

/**
 * Walks a template's `root` and every `blocks` definition it reaches,
 * recording every node-level `id` found, which block it belongs to (the
 * block it instantiates, for a `block`/`repeat` node itself; the enclosing
 * block, for a plain node inside one — e.g. `bulletMarker` inside
 * `bulletItem`), and whether that node has literal text worth a Text
 * override control. Static per template — call once, not per render. Powers
 * the Block Settings tab's grouped picker (`persona-field-tree.tsx`).
 */
export function collectBlockNodeIds(definition: TemplateDefinition): BlockNodeId[] {
  const out: BlockNodeId[] = []
  const seen = new Set<string>()

  function push(id: string | undefined, blockName: string | undefined, hasText: boolean) {
    if (id && blockName && !seen.has(id)) {
      seen.add(id)
      out.push({ id, blockName, hasText })
    }
  }

  function walk(
    node: TemplateNode,
    blocks: Record<string, BlockDef>,
    currentBlock: string | undefined,
    pathVisited: Set<string>
  ): void {
    if ("repeat" in node) {
      const { repeat } = node
      const target = repeat.block
      // A repeat's own override targets its wrapping tag, which has no
      // literal text of its own — only a style reference.
      push(repeat.id, target, false)
      if (!pathVisited.has(target)) {
        const blockDef = blocks[target]
        if (blockDef) {
          const nextVisited = new Set(pathVisited)
          nextVisited.add(target)
          walk(blockDef.node, blocks, target, nextVisited)
        }
      }
      if (repeat.separator) {
        walk(repeat.separator, blocks, target, pathVisited)
      }
      return
    }

    if ("block" in node) {
      const target = node.block
      // A block instance's override patches the block's own root node (see
      // `renderBlockInstance`), so text availability follows that root, not
      // this wrapper.
      push(node.id, target, hasLiteralText(blocks[target]?.node))
      if (!pathVisited.has(target)) {
        const blockDef = blocks[target]
        if (blockDef) {
          const nextVisited = new Set(pathVisited)
          nextVisited.add(target)
          walk(blockDef.node, blocks, target, nextVisited)
        }
      }
      return
    }

    if ("if" in node) {
      walk(node.then, blocks, currentBlock, pathVisited)
      if (node.else) walk(node.else, blocks, currentBlock, pathVisited)
      return
    }

    if ("join" in node) {
      for (const part of node.join.parts) walk(part, blocks, currentBlock, pathVisited)
      return
    }

    // ElementNode
    push(node.id, currentBlock, hasLiteralText(node))
    if (node.children) {
      for (const child of node.children) walk(child, blocks, currentBlock, pathVisited)
    }
  }

  walk(definition.root, definition.blocks, undefined, new Set())

  return out
}
