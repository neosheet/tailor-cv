import type { TemplateNode } from "@/lib/cv-template-schema"

/**
 * Reusable node trees shared by the built-in `TemplateDefinition`s — the JSON
 * equivalent of `primitives.tsx`'s `SectionHeading`/`BulletList`/`EntryBlock`/
 * `Section`. Spread into each definition's own `blocks` map at authoring time
 * (`{ ...sharedBlocks, ...ownBlocks }`) so every exported/stored definition
 * stays fully self-contained JSON — this file is an authoring convenience,
 * not a runtime dependency (docs/specs/05-cv-template-format.md, "Modularity").
 *
 * Colors are Tailwind v4's default neutral palette, referenced by the
 * `.tsx` class names they replace: neutral-300 #d4d4d4, neutral-400 #a3a3a3,
 * neutral-500 #737373, neutral-600 #525252, neutral-700 #404040,
 * neutral-900 #171717.
 */

/** Ported from `primitives.tsx`'s `SectionHeading`. */
const sectionHeading: TemplateNode = {
  type: "box",
  tag: "h2",
  style: {
    marginBottom: 8,
    borderBottom: "1px solid #d4d4d4",
    paddingBottom: 4,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  children: [{ type: "text", bind: "section.heading" }],
}

/**
 * Ported from `primitives.tsx`'s `BulletList`. Renders each bullet as a
 * literal glyph styled like any other text rather than a CSS list marker —
 * inline styles can't reach `::marker` (spec 05, "Style").
 */
const bulletList: TemplateNode = {
  type: "repeat",
  bind: "group.items",
  as: "item",
  tag: "ul",
  style: {
    marginTop: 4,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    paddingLeft: 16,
    listStyleType: "none",
  },
  child: {
    type: "box",
    tag: "li",
    style: { display: "flex", gap: 6, lineHeight: 1.375 },
    children: [
      { type: "text", literal: "•", style: { color: "#a3a3a3", flexShrink: 0 } },
      { type: "text", bind: "item" },
    ],
  },
}

/** Ported from `primitives.tsx`'s `EntryBlock`, branching on `entry.kind`. */
const entryBlock: TemplateNode = {
  type: "if",
  bind: "entry.kind",
  equals: "skill",
  then: {
    type: "box",
    tag: "div",
    style: { breakInside: "avoid", lineHeight: 1.375 },
    children: [
      { type: "text", bind: "entry.title", style: { fontWeight: 600 } },
      {
        type: "if",
        bind: "entry.subtitle",
        then: {
          type: "box",
          tag: "span",
          style: { color: "#737373" },
          children: [
            { type: "text", literal: " · " },
            { type: "text", bind: "entry.subtitle" },
          ],
        },
      },
      {
        type: "if",
        bind: "entry.keywords",
        then: {
          type: "box",
          tag: "span",
          style: { color: "#525252" },
          children: [
            { type: "text", literal: " — " },
            {
              type: "repeat",
              bind: "entry.keywords",
              as: "k",
              tag: "span",
              separator: { type: "text", literal: ", " },
              child: { type: "text", bind: "k" },
            },
          ],
        },
      },
    ],
  },
  else: {
    type: "if",
    bind: "entry.kind",
    in: ["language", "interest"],
    then: {
      type: "box",
      tag: "div",
      style: { breakInside: "avoid", lineHeight: 1.375 },
      children: [
        { type: "text", bind: "entry.title", style: { fontWeight: 600 } },
        {
          type: "if",
          bind: "entry.subtitle",
          then: {
            type: "box",
            tag: "span",
            style: { color: "#737373" },
            children: [
              { type: "text", literal: " · " },
              { type: "text", bind: "entry.subtitle" },
            ],
          },
        },
      ],
    },
    else: {
      type: "box",
      tag: "div",
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 2,
        breakInside: "avoid",
      },
      children: [
        {
          type: "box",
          tag: "div",
          style: {
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 16,
          },
          children: [
            {
              type: "box",
              tag: "h3",
              style: { fontWeight: 600 },
              children: [{ type: "text", bind: "entry.title" }],
            },
            {
              type: "text",
              bind: "entry.dateRangeText",
              style: {
                flexShrink: 0,
                fontSize: 11,
                color: "#737373",
                fontVariantNumeric: "tabular-nums",
              },
            },
          ],
        },
        {
          type: "box",
          tag: "p",
          style: { color: "#525252", fontStyle: "italic" },
          children: [
            {
              type: "join",
              parts: [
                { type: "text", bind: "entry.subtitle" },
                { type: "text", bind: "entry.details.studyType" },
              ],
              separator: " · ",
            },
            {
              type: "if",
              bind: "entry.details.score",
              then: {
                type: "box",
                tag: "span",
                style: { fontStyle: "normal" },
                children: [
                  { type: "text", literal: " (" },
                  { type: "text", bind: "entry.details.score" },
                  { type: "text", literal: ")" },
                ],
              },
            },
          ],
        },
        {
          type: "box",
          tag: "p",
          style: { marginTop: 2, lineHeight: 1.375, color: "#404040" },
          children: [{ type: "text", bind: "entry.summary" }],
        },
        {
          type: "repeat",
          bind: "entry.lineGroups",
          as: "group",
          style: { display: "flex", flexDirection: "column", gap: 2 },
          child: { type: "ref", block: "bulletList", with: { group: "group" } },
        },
      ],
    },
  },
}

/**
 * Ported from `primitives.tsx`'s `Section`. Skill/language/interest entries
 * sit tighter together (`gap-0.5`) than every other kind (`gap-3`).
 */
const section: TemplateNode = {
  type: "box",
  tag: "section",
  style: { display: "flex", flexDirection: "column" },
  children: [
    { type: "ref", block: "sectionHeading", with: { section: "section" } },
    {
      type: "if",
      bind: "section.kind",
      in: ["skill", "language", "interest"],
      then: {
        type: "repeat",
        bind: "section.entries",
        as: "entry",
        tag: "div",
        style: { display: "flex", flexDirection: "column", gap: 2 },
        child: { type: "ref", block: "entryBlock", with: { entry: "entry" } },
      },
      else: {
        type: "repeat",
        bind: "section.entries",
        as: "entry",
        tag: "div",
        style: { display: "flex", flexDirection: "column", gap: 12 },
        child: { type: "ref", block: "entryBlock", with: { entry: "entry" } },
      },
    },
  ],
}

export const sharedBlocks: Record<string, TemplateNode> = {
  sectionHeading,
  bulletList,
  entryBlock,
  section,
}
