import type { PageConfig } from "@/lib/cv-template-schema"
import type { StylePropertyDef } from "@/lib/style-property-schema"

/**
 * Manifest for the Page tab — same idea as `style-property-schema.ts`, but
 * for `TemplateDefinition.page` instead of a named style. Unlike the style
 * registry, `PageConfig` is a small closed set of fields, so every key here
 * always shows (no "add property" picker) — and `header`/`footer` are
 * excluded entirely: they hold structured `TemplateNode` content, not a
 * scalar a simple form control can edit.
 */
export const PAGE_PROPERTY_SCHEMA: Partial<Record<keyof PageConfig, StylePropertyDef>> = {
  size: {
    title: "Paper size",
    input: "select",
    group: "Layout",
    options: ["A4", "LETTER", "LEGAL"],
  },
  orientation: {
    title: "Orientation",
    input: "select",
    group: "Layout",
    options: ["portrait", "landscape"],
  },
  margin: { title: "Margin", input: "number", group: "Spacing", step: 1 },
  headerSpace: { title: "Header space", input: "number", group: "Spacing", step: 1 },
  footerSpace: { title: "Footer space", input: "number", group: "Spacing", step: 1 },
  fontFamily: { title: "Font family", input: "text", group: "Text" },
  fontSize: { title: "Base font size", input: "number", group: "Text", step: 0.25 },
  lineHeight: { title: "Line height", input: "number", group: "Text", step: 0.05 },
  color: { title: "Text color", input: "color", group: "Color" },
}

/** The fields the Page tab actually renders — every `PAGE_PROPERTY_SCHEMA` key, in schema order. */
export const EDITABLE_PAGE_KEYS = Object.keys(
  PAGE_PROPERTY_SCHEMA
) as (keyof typeof PAGE_PROPERTY_SCHEMA)[]
