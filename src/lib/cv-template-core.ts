/**
 * Framework-free shared core for CV template rendering.
 * Mirrors json-ui/src/jsonui/core.js: scope/placeholder resolution and style flattening.
 * Imported by both DOM backend (template-node-renderer.tsx) and PDF backend (template-pdf-renderer.tsx).
 */

import type { ResumeDocument } from "@/lib/persona"

/** Sigil-based scope: $data (document root), $prop (block props), $item/$index (repeat context). */
export type TemplateScope = {
  prop?: Record<string, unknown>
  item?: unknown
  index?: number
}

export type Style = Record<string, string | number>
export type StyleDef = Style & { extends?: string[] }

/**
 * Resolve a single value against the template scope.
 * Implements spec 07's scope table (docs/specs/07:241-264):
 * - Whole-string $-prefixed placeholders only (no interpolation)
 * - $data.* → document root
 * - $prop.* → current block props
 * - $item.* → repeat loop item (pre-block scope only)
 * - $index → repeat loop index (pre-block scope only)
 * - Unrecognized roots return literal string unchanged
 */
export function resolveValue(
  value: unknown,
  scope: TemplateScope,
  data: ResumeDocument
): unknown {
  if (typeof value !== "string") return value
  if (!value.startsWith("$")) return value

  const dotIndex = value.indexOf(".")
  if (dotIndex === -1) {
    // Bare sigils (no dot-path) resolve to the whole referenced value —
    // e.g. `$item` inside a `repeat.as` over a string[] like contactParts,
    // where there's no nested field to walk into.
    if (value === "$index") return scope.index
    if (value === "$item") return scope.item
    if (value === "$prop") return scope.prop
    if (value === "$data") return data
    return value
  }

  const root = value.slice(0, dotIndex)
  const path = value.slice(dotIndex + 1)

  let obj: unknown
  if (root === "$data") obj = data
  else if (root === "$prop") obj = scope.prop
  else if (root === "$item") obj = scope.item
  else return value // unrecognized root

  // Walk dot-path, undefined-safe (no throw)
  return getPath(obj, path)
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
