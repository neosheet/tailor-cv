import type { BlockDef } from "@/lib/cv-template-schema"

/**
 * Reusable block definitions shared by built-in templates — the JSON equivalent
 * of `primitives.tsx`'s `SectionHeading`/`BulletList`/`EntryBlock`/`Section`.
 * Spread into each definition's own `blocks` map at authoring time so every
 * exported/stored definition stays fully self-contained JSON.
 *
 * Conversion notes:
 * - `bind: "path"` → `text: "$data.path"` or `text: "$prop.path"` depending on scope
 * - `ref.with` → `block` instance node with `props`
 * - Pixel values → points (× 0.75)
 */

/** Ported from `primitives.tsx`'s `SectionHeading`. */
const sectionHeading: BlockDef = {
  props: ["section"],
  node: {
    tag: "h2",
    styles: "sectionHeading",
    children: [{ text: "$prop.section.heading" }],
  },
}

/**
 * Ported from `primitives.tsx`'s `BulletList`. Renders each bullet as a
 * literal glyph styled like any other text rather than a CSS list marker.
 */
const bulletList: BlockDef = {
  props: ["group"],
  node: {
    repeat: {
      block: "bulletItem",
      for: "$prop.group.items",
      as: { item: "$item" },
      tag: "ul",
      styles: "bulletListContainer",
      separator: undefined,
    },
  },
}

const bulletItem: BlockDef = {
  props: ["item"],
  node: {
    tag: "li",
    styles: "bulletItem",
    children: [
      { text: "•", styles: "bulletMarker" },
      { text: "$prop.item" },
    ],
  },
}

/** Ported from `primitives.tsx`'s `EntryBlock`, branching on `entry.kind`. */
const entryBlock: BlockDef = {
  props: ["entry"],
  node: {
    if: "$prop.entry.kind",
    equals: "skill",
    then: {
      tag: "div",
      styles: "entrySkillBlock",
      children: [
        { text: "$prop.entry.title", styles: "entryTitle" },
        {
          if: "$prop.entry.subtitle",
          then: {
            tag: "span",
            styles: "entrySubtitleMuted",
            children: [
              { text: " · " },
              { text: "$prop.entry.subtitle" },
            ],
          },
        },
        {
          if: "$prop.entry.keywords",
          then: {
            tag: "span",
            styles: "entryKeywordsMuted",
            children: [
              { text: " — " },
              {
                repeat: {
                  block: "entryKeyword",
                  for: "$prop.entry.keywords",
                  as: { k: "$item" },
                  tag: "span",
                  separator: { text: ", " },
                },
              },
            ],
          },
        },
      ],
    },
    else: {
      if: "$prop.entry.kind",
      in: ["language", "interest"],
      then: {
        tag: "div",
        styles: "entrySkillBlock",
        children: [
          { text: "$prop.entry.title", styles: "entryTitle" },
          {
            if: "$prop.entry.subtitle",
            then: {
              tag: "span",
              styles: "entrySubtitleMuted",
              children: [
                { text: " · " },
                { text: "$prop.entry.subtitle" },
              ],
            },
          },
        ],
      },
      else: {
        tag: "div",
        styles: "entryRegularBlock",
        children: [
          {
            tag: "div",
            styles: "entryHeaderRow",
            children: [
              {
                tag: "h3",
                styles: "entryTitle",
                children: [{ text: "$prop.entry.title" }],
              },
              {
                text: "$prop.entry.dateRangeText",
                styles: "entryDate",
              },
            ],
          },
          {
            tag: "p",
            styles: "entrySubtitleBlock",
            children: [
              {
                join: {
                  parts: [
                    { text: "$prop.entry.subtitle" },
                    { text: "$prop.entry.details.studyType" },
                  ],
                  separator: " · ",
                },
              },
              {
                if: "$prop.entry.details.score",
                then: {
                  tag: "span",
                  styles: "entryScoreInline",
                  children: [
                    { text: " (" },
                    { text: "$prop.entry.details.score" },
                    { text: ")" },
                  ],
                },
              },
            ],
          },
          {
            tag: "p",
            styles: "entrySummary",
            children: [{ text: "$prop.entry.summary" }],
          },
          {
            repeat: {
              block: "bulletList",
              for: "$prop.entry.lineGroups",
              as: { group: "$item" },
              styles: "entryLineGroupsContainer",
            },
          },
        ],
      },
    },
  },
}

const entryKeyword: BlockDef = {
  props: ["k"],
  node: { text: "$prop.k" },
}

/**
 * Ported from `primitives.tsx`'s `Section`. Skill/language/interest entries
 * sit tighter together than every other kind.
 */
const section: BlockDef = {
  props: ["section"],
  node: {
    tag: "section",
    styles: "section",
    children: [
      {
        block: "sectionHeading",
        props: { section: "$prop.section" },
      },
      {
        if: "$prop.section.kind",
        in: ["skill", "language", "interest"],
        then: {
          repeat: {
            block: "entryBlock",
            for: "$prop.section.entries",
            as: { entry: "$item" },
            tag: "div",
            styles: "entryContainerTight",
          },
        },
        else: {
          repeat: {
            block: "entryBlock",
            for: "$prop.section.entries",
            as: { entry: "$item" },
            tag: "div",
            styles: "entryContainerSpaced",
          },
        },
      },
    ],
  },
}

const contactPart: BlockDef = {
  props: ["part"],
  node: { text: "$prop.part" },
}

export const sharedBlocks: Record<string, BlockDef> = {
  sectionHeading,
  bulletList,
  bulletItem,
  entryBlock,
  entryKeyword,
  section,
  contactPart,
}
