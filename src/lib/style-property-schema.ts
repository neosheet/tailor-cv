/**
 * Manifest for the Style tab's property controls — mirrors json-ui's
 * `propertySchema.json` (see `~/Desktop/json-ui/src/jsonui/editor/`): each
 * key a template's `styles` registry might use gets a friendly title, an
 * input kind, and a group for the tab's layout.
 *
 * Unlike json-ui's DOM-first `px`/`em`/`%` values, spec 07 templates
 * (`cv-template-schema.ts`) store lengths as bare point numbers — scaled to
 * pixels only at DOM-render time (`template-node-renderer.tsx`'s `scaleStyle`)
 * — so there's no unit suffix to edit here, just a number.
 */

export type StylePropertyInput = "number" | "select" | "color" | "text"

export type StylePropertyOption = string | number | { value: string | number; label: string }

export type StylePropertyDef = {
  title: string
  input: StylePropertyInput
  group: StyleGroup
  options?: StylePropertyOption[]
  step?: number
}

export type StyleGroup = "Text" | "Color" | "Spacing" | "Size" | "Border" | "Layout" | "Other"

export const STYLE_GROUP_ORDER: StyleGroup[] = [
  "Text",
  "Color",
  "Spacing",
  "Size",
  "Border",
  "Layout",
  "Other",
]

export const STYLE_PROPERTY_SCHEMA: Record<string, StylePropertyDef> = {
  fontSize: { title: "Font size", input: "number", group: "Text", step: 0.25 },
  fontWeight: {
    title: "Weight",
    input: "select",
    group: "Text",
    options: [
      { value: 300, label: "Light" },
      { value: 400, label: "Regular" },
      { value: 500, label: "Medium" },
      { value: 600, label: "Semibold" },
      { value: 700, label: "Bold" },
      { value: 800, label: "Extrabold" },
    ],
  },
  fontFamily: { title: "Font family", input: "text", group: "Text" },
  fontStyle: { title: "Italic / normal", input: "select", group: "Text", options: ["normal", "italic"] },
  fontVariantNumeric: {
    title: "Numeric variant",
    input: "select",
    group: "Text",
    options: ["normal", "tabular-nums", "oldstyle-nums"],
  },
  textAlign: {
    title: "Alignment",
    input: "select",
    group: "Text",
    options: ["left", "center", "right", "justify"],
  },
  textTransform: {
    title: "Letter case",
    input: "select",
    group: "Text",
    options: ["none", "uppercase", "lowercase", "capitalize"],
  },
  textDecoration: {
    title: "Decoration",
    input: "select",
    group: "Text",
    options: ["none", "underline", "line-through"],
  },
  letterSpacing: { title: "Letter spacing", input: "number", group: "Text", step: 0.25 },
  lineHeight: { title: "Line height", input: "number", group: "Text", step: 0.05 },

  color: { title: "Text color", input: "color", group: "Color" },
  backgroundColor: { title: "Background color", input: "color", group: "Color" },
  borderColor: { title: "Border color", input: "color", group: "Color" },

  padding: { title: "Padding (all)", input: "number", group: "Spacing" },
  paddingTop: { title: "Padding — top", input: "number", group: "Spacing" },
  paddingBottom: { title: "Padding — bottom", input: "number", group: "Spacing" },
  paddingLeft: { title: "Padding — left", input: "number", group: "Spacing" },
  paddingRight: { title: "Padding — right", input: "number", group: "Spacing" },
  paddingVertical: { title: "Padding — vertical", input: "number", group: "Spacing" },
  paddingHorizontal: { title: "Padding — horizontal", input: "number", group: "Spacing" },
  margin: { title: "Margin (all)", input: "number", group: "Spacing" },
  marginTop: { title: "Margin — top", input: "number", group: "Spacing" },
  marginBottom: { title: "Margin — bottom", input: "number", group: "Spacing" },
  marginLeft: { title: "Margin — left", input: "number", group: "Spacing" },
  marginRight: { title: "Margin — right", input: "number", group: "Spacing" },
  gap: { title: "Gap", input: "number", group: "Spacing" },

  width: { title: "Width", input: "number", group: "Size" },
  height: { title: "Height", input: "number", group: "Size" },

  borderWidth: { title: "Border width", input: "number", group: "Border" },
  borderRadius: { title: "Corner radius", input: "number", group: "Border" },
  borderBottom: { title: "Border bottom (shorthand)", input: "text", group: "Border" },
  borderTop: { title: "Border top (shorthand)", input: "text", group: "Border" },

  display: { title: "Display", input: "select", group: "Layout", options: ["flex", "none"] },
  flexDirection: { title: "Direction", input: "select", group: "Layout", options: ["row", "column"] },
  justifyContent: {
    title: "Justify (main axis)",
    input: "select",
    group: "Layout",
    options: ["flex-start", "center", "flex-end", "space-between", "space-around"],
  },
  alignItems: {
    title: "Align (cross axis)",
    input: "select",
    group: "Layout",
    options: ["flex-start", "center", "flex-end", "stretch", "baseline"],
  },
  flexGrow: { title: "Grow", input: "number", group: "Layout" },
  flexShrink: { title: "Shrink", input: "number", group: "Layout" },
  breakInside: { title: "Break inside", input: "select", group: "Layout", options: ["auto", "avoid"] },

  listStyleType: { title: "List marker", input: "select", group: "Other", options: ["none", "disc", "decimal"] },
}

const COLOR_KEYS = new Set(["color", "backgroundColor", "borderColor"])

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)
}

/** "fontVariantNumeric" → "Font variant numeric", for keys the schema doesn't name. */
export function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/** A property's def, falling back to an inferred one for keys the schema doesn't list. */
export function stylePropertyDef(key: string, value: unknown): StylePropertyDef {
  const known = STYLE_PROPERTY_SCHEMA[key]
  if (known) {
    return known
  }

  if (COLOR_KEYS.has(key) || isHexColor(value)) {
    return { title: humanize(key), input: "color", group: "Color" }
  }
  if (typeof value === "number") {
    return { title: humanize(key), input: "number", group: "Other" }
  }
  return { title: humanize(key), input: "text", group: "Other" }
}

/** Normalizes `options` to `{value, label}` pairs, appending the current value if it's off-list. */
export function normalizeOptions(
  options: StylePropertyOption[] | undefined,
  value: unknown
): { value: string | number; label: string }[] {
  const list = (options ?? []).map((option) =>
    typeof option === "object" ? option : { value: option, label: String(option) }
  )

  if (
    (typeof value === "string" || typeof value === "number") &&
    !list.some((option) => String(option.value) === String(value))
  ) {
    list.push({ value, label: String(value) })
  }

  return list
}

/** A sensible starting value when a property is added fresh (not yet on the base style). */
export function defaultStyleValue(key: string): string | number {
  const def = stylePropertyDef(key, undefined)
  if (def.input === "color") return "#171717"
  if (def.input === "select") return normalizeOptions(def.options, undefined)[0]?.value ?? ""
  if (def.input === "number") return key === "lineHeight" ? 1.4 : key === "fontSize" ? 10 : 0
  return ""
}
