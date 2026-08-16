import { applyStyleTextOverride } from "@/lib/cv-template-core"
import type {
  BlockDef,
  ElementNode,
  NodeOverride,
  PageConfig,
  StyleDef,
  TemplateDefinition,
  TemplateNode,
  TemplateSettings,
} from "@/lib/cv-template-schema"

/**
 * Produces a standalone `TemplateDefinition` with a CV's `template_settings`
 * fully applied — the result renders identically with no `settings` passed
 * at all. See docs/specs/13-save-as-new-template.md.
 *
 * Uses `applyStyleTextOverride` from cv-template-core.ts — the same function
 * `template-node-renderer.tsx` applies at render time — so a node's own
 * `styles`/`text` override *replaces* that field (does not merge onto it)
 * identically in both places, by construction rather than by convention. The
 * one place this can't be a simple in-place tree patch: a `BlockInstanceNode`'s
 * own `styles`/`text` override patches only *that call site's* copy of the
 * block's root node (`renderBlockInstance`) — other instantiations of the
 * same block by name are untouched at render time. Baking that in place onto
 * the shared `blocks[name]` entry would incorrectly leak the override to
 * every other call site referencing the same block, so that one case clones
 * the block under a private name and repoints just this call site at the
 * clone. Every other override (an `ElementNode`'s own id, a `RepeatNode`'s
 * own id) is safe to patch directly on the node object encountered during
 * the walk, since render-time settings already apply those the same way
 * regardless of which path reaches them.
 */
export function bakeTemplateSettings(
  definition: TemplateDefinition,
  settings: TemplateSettings
): TemplateDefinition {
  const page: PageConfig = { ...definition.page, ...settings.page }

  const styles: Record<string, StyleDef> = { ...definition.styles }
  for (const [name, override] of Object.entries(settings.styles ?? {})) {
    styles[name] = { ...styles[name], ...override }
  }

  const nodeOverrides = settings.nodes ?? {}
  if (Object.keys(nodeOverrides).length === 0) {
    return { ...definition, page, styles }
  }

  const blocks: Record<string, BlockDef> = { ...definition.blocks }
  const visited = new Set<string>()
  const root = bakeNode(definition.root, nodeOverrides, blocks, visited) ?? emptyNode()

  return { ...definition, page, styles, blocks, root }
}

function emptyNode(): TemplateNode {
  return { tag: "div" }
}

/** Bakes any nested `ElementNode`-id overrides into `blocks[name]`'s own tree, in place, once. */
function bakeBlockInPlace(
  name: string,
  overrides: Record<string, NodeOverride>,
  blocks: Record<string, BlockDef>,
  visited: Set<string>
): void {
  if (visited.has(name)) return
  visited.add(name)

  const def = blocks[name]
  if (!def) return

  const baked = bakeNode(def.node, overrides, blocks, visited)
  blocks[name] = { ...def, node: baked ?? emptyNode() }
}

/** Returns `undefined` when the node itself is hidden — the caller drops that slot. */
function bakeNode(
  node: TemplateNode,
  overrides: Record<string, NodeOverride>,
  blocks: Record<string, BlockDef>,
  visited: Set<string>
): TemplateNode | undefined {
  if ("repeat" in node) {
    const override = node.repeat.id ? overrides[node.repeat.id] : undefined
    if (override?.hidden) return undefined

    bakeBlockInPlace(node.repeat.block, overrides, blocks, visited)

    return {
      repeat: {
        ...node.repeat,
        styles: override?.styles !== undefined ? override.styles : node.repeat.styles,
        separator: node.repeat.separator
          ? bakeNode(node.repeat.separator, overrides, blocks, visited)
          : node.repeat.separator,
      },
    }
  }

  if ("block" in node) {
    const override = node.id ? overrides[node.id] : undefined
    if (override?.hidden) return undefined

    const target = node.block
    bakeBlockInPlace(target, overrides, blocks, visited)

    if (override?.styles !== undefined || override?.text !== undefined) {
      // Private clone — see this function's doc comment above.
      const cloneName = `${target}__${node.id}`
      const baseNode = blocks[target]!.node
      blocks[cloneName] = {
        ...blocks[target],
        node: applyStyleTextOverride(baseNode, override),
      }
      return { ...node, block: cloneName }
    }

    return { ...node }
  }

  if ("if" in node) {
    return {
      ...node,
      then: bakeNode(node.then, overrides, blocks, visited) ?? emptyNode(),
      else: node.else ? bakeNode(node.else, overrides, blocks, visited) : undefined,
    }
  }

  if ("join" in node) {
    const parts = node.join.parts
      .map((part) => bakeNode(part, overrides, blocks, visited))
      .filter((part): part is TemplateNode => part !== undefined)
    return { join: { ...node.join, parts } }
  }

  // ElementNode
  const override = node.id ? overrides[node.id] : undefined
  if (override?.hidden) return undefined

  // `applyStyleTextOverride` returns `node` itself, unchanged, when there's
  // no override — fine for the renderer, but this function must always
  // return a tree fully independent of `definition` (never mutate a node
  // shared with it), so the children patch below is a fresh spread rather
  // than an in-place write, regardless of which branch `overridden` took.
  const overridden = applyStyleTextOverride(node, override)
  const children = overridden.children
    ? overridden.children
        .map((child) => bakeNode(child, overrides, blocks, visited))
        .filter((child): child is TemplateNode => child !== undefined)
    : undefined

  const patched: ElementNode = {
    ...overridden,
    children: children && children.length > 0 ? children : undefined,
  }

  return patched
}
