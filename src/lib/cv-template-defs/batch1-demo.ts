import type { BlockDef } from "@/lib/cv-template-schema"
import {
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/cv-template-schema"

/**
 * Demo-only template for Batch 1 (docs/user-request.md) — not a real layout
 * choice, just a live surface to try the two new template-engine capabilities
 * against real data: string-literal interpolation in `text`, and `repeat.merge`
 * for a joined list instead of one block per item. Otherwise identical to
 * Classic (same styles, same everything-but-Skills sections).
 *
 * Self-contained per Batch 3 (docs/user-request.md) — blocks defined locally,
 * no `cv-template-blocks.ts` import. Carries two `id`s (`bulletMarker`,
 * `contactSeparatorText`) so the Block Settings tab has something to try here too.
 */

const sectionHeading: BlockDef = {
  props: ["section"],
  node: {
    tag: "h2",
    styles: "sectionHeading",
    children: [{ text: "$prop.section.heading" }],
  },
}

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
      { text: "•", styles: "bulletMarker", id: "bulletMarker" },
      { text: "$prop.item" },
    ],
  },
}

const entryKeyword: BlockDef = {
  props: ["k"],
  node: { text: "$prop.k" },
}

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
            children: [{ text: " · " }, { text: "$prop.entry.subtitle" }],
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
              children: [{ text: " · " }, { text: "$prop.entry.subtitle" }],
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
              { text: "$prop.entry.dateRangeText", styles: "entryDate" },
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
            if: "$prop.entry.url",
            then: {
              tag: "p",
              styles: "entryUrlLine",
              children: [{ text: "$prop.entry.url" }],
            },
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

const section: BlockDef = {
  props: ["section"],
  node: {
    tag: "section",
    styles: "section",
    children: [
      { block: "sectionHeading", props: { section: "$prop.section" } },
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
  node: { tag: "li", text: "$prop.part", styles: "entryContactPart" },
}

/** Renders a section's entries as one joined `<p>` instead of `entryContainerTight`'s one-block-per-entry. */
const mergedEntriesSection: BlockDef = {
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
        repeat: {
          // `block` is required by the schema even in merge mode, though
          // unused for rendering — merge resolves `merge.text` directly.
          block: "entryKeyword",
          for: "$prop.section.entries",
          as: { entry: "$item" },
          tag: "p",
          styles: "summaryBlock",
          merge: { text: "$item.title", separator: ", ", end: "." },
        },
      },
    ],
  },
}

export const batch1DemoTemplateDefinition: TemplateDefinition =
  parseTemplateDefinition({
    schemaVersion: 2,
    id: "batch1-demo",
    name: "Batch 1 Demo (interpolation + merge)",
    description:
      "Classic, but the intro line uses string interpolation and the Skills section renders as one merged, comma-separated sentence instead of a list — a live test surface for the two new template-engine capabilities, not a real layout choice.",
    density: "Balanced",
    atsSafe: false,
    bestFor: "Trying out Batch 1's template-engine changes against real data",

    page: {
      size: "A4",
      margin: 40,
      fontFamily: "Helvetica",
      fontSize: 9.375,
      lineHeight: 1.4,
      color: "#171717",
    },

    styles: {
      sectionHeading: {
        marginBottom: 6,
        borderBottom: "1pt solid #d4d4d4",
        paddingBottom: 3,
        fontSize: 8.25,
        fontWeight: 600,
        letterSpacing: 1,
        textTransform: "uppercase",
      },
      bulletListContainer: {
        marginTop: 3,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        paddingLeft: 12,
        listStyleType: "none",
      },
      bulletItem: { display: "flex", gap: 4.5, lineHeight: 1.375 },
      bulletMarker: { color: "#a3a3a3", flexShrink: 0 },
      entryTitle: { fontWeight: 600 },
      entrySubtitleMuted: { color: "#737373" },
      entryKeywordsMuted: { color: "#525252" },
      entrySkillBlock: { breakInside: "avoid", lineHeight: 1.375 },
      entryRegularBlock: {
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        breakInside: "avoid",
      },
      entryHeaderRow: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
      },
      entryDate: {
        flexShrink: 0,
        fontSize: 8.25,
        color: "#737373",
        fontVariantNumeric: "tabular-nums",
      },
      entrySubtitleBlock: { color: "#525252", fontStyle: "italic" },
      entryUrlLine: { color: "#525252", fontSize: 8.25 },
      entryScoreInline: { fontStyle: "normal" },
      entrySummary: { marginTop: 1.5, lineHeight: 1.375, color: "#404040" },
      entryLineGroupsContainer: {
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      },
      entryContainerTight: {
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      },
      entryContainerSpaced: { display: "flex", flexDirection: "column", gap: 9 },
      section: { display: "flex", flexDirection: "column" },
      headerBox: { display: "flex", flexDirection: "column", gap: 3 },
      headerName: { fontSize: 18, fontWeight: 700, letterSpacing: -0.45 },
      headerHeadline: { fontSize: 9.75, color: "#525252" },
      contactPartsContainer: {
        display: "flex",
        flexDirection: "row",
        gap: 3,
        fontSize: 8.25,
        color: "#525252",
      },
      contactSeparator: { color: "#a3a3a3" },
      // Interpolation demo line — string-literal composition of $data sigils.
      introLine: {
        marginTop: 9,
        fontSize: 9.75,
        fontStyle: "italic",
        color: "#404040",
      },
      summaryBlock: { marginTop: 15, lineHeight: 1.625, color: "#404040" },
      sectionsContainer: {
        marginTop: 21,
        display: "flex",
        flexDirection: "column",
        gap: 18,
      },
    },

    blocks: {
      sectionHeading,
      bulletList,
      bulletItem,
      entryBlock,
      entryKeyword,
      section,
      contactPart,
      mergedEntriesSection,
    },

    stylesSchema: {
      bulletMarker: { title: "Bullet marker", description: "The glyph in front of each bullet point." },
      contactSeparator: { title: "Contact separator", description: "The \"|\" glyph between contact details." },
      introLine: { title: "Intro line", description: "The interpolation demo line under the header." },
      headerName: { title: "Name (header)", description: "Your name, in large type at the top." },
    },

    blocksSchema: {
      bulletItem: { title: "Bullet item", description: "Renders one bullet point — marker plus text." },
      mergedEntriesSection: { title: "Merged section", description: "Renders a section's entries as one joined, comma-separated sentence — the merge-mode demo." },
    },

    root: {
      tag: "div",
      children: [
        {
          tag: "header",
          styles: "headerBox",
          children: [
            {
              tag: "h1",
              styles: "headerName",
              children: [{ text: "$data.name" }],
            },
            {
              if: "$data.headline",
              then: {
                tag: "p",
                styles: "headerHeadline",
                children: [{ text: "$data.headline" }],
              },
            },
            {
              repeat: {
                block: "contactPart",
                for: "$data.contactParts",
                as: { part: "$item" },
                tag: "ul",
                styles: "contactPartsContainer",
                separator: {
                  tag: "li",
                  styles: "contactSeparator",
                  children: [{ text: "|", id: "contactSeparatorText" }],
                },
              },
            },
          ],
        },
        {
          // Interpolation demo — matches the example in docs/user-request.md
          // verbatim: a literal string with two embedded $data sigils.
          tag: "p",
          styles: "introLine",
          text: "Hello, my name is $data.name and I'm a $data.headline.",
        },
        {
          if: "$data.summary",
          then: {
            tag: "p",
            styles: "summaryBlock",
            children: [{ text: "$data.summary" }],
          },
        },
        {
          tag: "div",
          styles: "sectionsContainer",
          children: [
            {
              // Skills only, rendered merged — the other sections keep the
              // normal one-block-per-entry `section` block below.
              repeat: {
                block: "mergedEntriesSection",
                for: "$data.sections",
                as: { section: "$item" },
                filter: { field: "$item.kind", op: "in", value: ["skill"] },
              },
            },
            {
              repeat: {
                block: "section",
                for: "$data.sections",
                as: { section: "$item" },
                filter: { field: "$item.kind", op: "not-in", value: ["skill"] },
              },
            },
          ],
        },
      ],
    },
  })
