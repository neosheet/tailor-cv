import type { BlockDef } from "@/lib/cv-template-schema"
import {
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/cv-template-schema"

/**
 * Two Column template for spec 07 format. Same centred header as Classic,
 * then a two-column body: Experience gets the wide main column, every other
 * section (education, skills, projects, etc.) stacks in a narrower side
 * column. Pixel values converted to points (× 0.75), matching Classic.
 *
 * Fully self-contained (Batch 3, docs/user-request.md) — every block this
 * template uses is defined locally below, no shared `cv-template-blocks.ts`
 * import (a near-duplicate of Classic's own local blocks; kept independent
 * per-template on purpose rather than re-sharing, per the request).
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

/** Branches on `entry.kind`. */
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
                  separator: { text: ", ", id: "keywordSeparator" },
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

/** Skill/language/interest entries sit tighter together than every other kind. */
const section: BlockDef = {
  props: ["section"],
  node: {
    tag: "section",
    styles: "section",
    children: [
      {
        block: "sectionHeading",
        props: { section: "$prop.section" },
        id: "sectionHeadingInstance",
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
            id: "entryBlockRepeatTight",
          },
        },
        else: {
          repeat: {
            block: "entryBlock",
            for: "$prop.section.entries",
            as: { entry: "$item" },
            tag: "div",
            styles: "entryContainerSpaced",
            id: "entryBlockRepeatSpaced",
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
export const twoColumnTemplateDefinition: TemplateDefinition =
  parseTemplateDefinition({
    schemaVersion: 2,
    id: "two-column",
    name: "Two Column",
    description:
      "A centred header over a two-column body: Experience leads in a wide main column, everything else sits in a compact side column.",
    density: "Balanced",
    atsSafe: false,
    bestFor: "Design-forward applications reviewed by a person rather than parsed by a bot",

    page: {
      size: "A4",
      margin: 40, // 40px → 30pt (40 × 0.75)
      fontFamily: "Helvetica",
      fontSize: 9.375, // 12.5px → 9.375pt (12.5 × 0.75)
      lineHeight: 1.4,
      color: "#171717",
    },

    styles: {
      // Shared base styles for section headings
      sectionHeading: {
        marginBottom: 6, // 8px → 6pt
        borderBottom: "1pt solid #d4d4d4",
        paddingBottom: 3, // 4px → 3pt
        fontSize: 8.25, // 11px → 8.25pt
        fontWeight: 600,
        letterSpacing: 1, // 0.12em @ 8.25pt ≈ 1pt
        textTransform: "uppercase",
      },

      // Bullet list container
      bulletListContainer: {
        marginTop: 3, // 4px → 3pt
        display: "flex",
        flexDirection: "column",
        gap: 1.5, // 2px → 1.5pt
        paddingLeft: 12, // 16px → 12pt
        listStyleType: "none",
      },

      // Individual bullet item
      bulletItem: {
        display: "flex",
        gap: 4.5, // 6px → 4.5pt
        lineHeight: 1.375,
      },

      // Bullet marker styling
      bulletMarker: {
        color: "#a3a3a3",
        flexShrink: 0,
      },

      // Entry title (h3 or bold text)
      entryTitle: {
        fontWeight: 600,
      },

      // Entry subtitle (muted)
      entrySubtitleMuted: {
        color: "#737373",
      },

      // Entry keywords (muted)
      entryKeywordsMuted: {
        color: "#525252",
      },

      // Skill/language/interest entry
      entrySkillBlock: {
        breakInside: "avoid",
        lineHeight: 1.375,
      },

      // Regular entry (work, education, etc.)
      entryRegularBlock: {
        display: "flex",
        flexDirection: "column",
        gap: 1.5, // 2px → 1.5pt
        breakInside: "avoid",
      },

      // Entry header row (title + date)
      entryHeaderRow: {
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12, // 16px → 12pt
      },

      // Entry date (subtitle)
      entryDate: {
        flexShrink: 0,
        fontSize: 8.25, // 11px → 8.25pt
        color: "#737373",
        fontVariantNumeric: "tabular-nums",
      },

      // Entry subtitle block (italic)
      entrySubtitleBlock: {
        color: "#525252",
        fontStyle: "italic",
      },

      // Entry URL (below subtitle, above summary)
      entryUrlLine: {
        color: "#525252",
        fontSize: 8.25, // 11px → 8.25pt
      },

      // Entry score (inline, normal font style)
      entryScoreInline: {
        fontStyle: "normal",
      },

      // Entry summary paragraph
      entrySummary: {
        marginTop: 1.5, // 2px → 1.5pt
        lineHeight: 1.375,
        color: "#404040",
      },

      // Entry line groups container
      entryLineGroupsContainer: {
        display: "flex",
        flexDirection: "column",
        gap: 1.5, // 2px → 1.5pt
      },

      // Entry containers with different gaps
      entryContainerTight: {
        display: "flex",
        flexDirection: "column",
        gap: 1.5, // 2px → 1.5pt
      },

      entryContainerSpaced: {
        display: "flex",
        flexDirection: "column",
        gap: 9, // 12px → 9pt
      },

      // Section element
      section: {
        display: "flex",
        flexDirection: "column",
      },

      // Header styles (centered)
      headerBox: {
        display: "flex",
        flexDirection: "column",
        gap: 3, // 4px → 3pt
      },

      // Header name (h1)
      headerName: {
        fontSize: 18, // 24px → 18pt
        fontWeight: 700,
        letterSpacing: -0.45, // -0.025em @ 18pt
      },

      // Header headline/subtitle (muted)
      headerHeadline: {
        fontSize: 9.75, // 13px → 9.75pt
        color: "#525252",
      },

      // Contact parts container
      contactPartsContainer: {
        display: "flex",
        flexDirection: "row",
        gap: 3, // 4px → 3pt
        fontSize: 8.25, // 11px → 8.25pt
        color: "#525252",
      },

      // Contact separator
      contactSeparator: {
        color: "#a3a3a3",
      },

      // Summary block (muted)
      summaryBlock: {
        marginTop: 15, // 20px → 15pt
        lineHeight: 1.625,
        color: "#404040",
      },

      // Two-column body: wide main column (Experience) + narrow side column
      // (everything else). flexGrow ratio 2:1 keeps the split proportional
      // without hand-computed widths fighting the column gap.
      bodyContainer: {
        marginTop: 21, // 28px → 21pt
        display: "flex",
        flexDirection: "row",
        gap: 18, // 24px → 18pt
      },

      mainColumn: {
        display: "flex",
        flexDirection: "column",
        gap: 18, // 24px → 18pt
        flexGrow: 2,
        flexBasis: 0,
      },

      secondaryColumn: {
        display: "flex",
        flexDirection: "column",
        gap: 13.5, // 18px → 13.5pt — tighter, since this column is narrower
        flexGrow: 1,
        flexBasis: 0,
      },

      // Sections container within each column
      sectionsContainer: {
        display: "flex",
        flexDirection: "column",
        gap: 18, // 24px → 18pt
      },

      sectionsContainerSecondary: {
        display: "flex",
        flexDirection: "column",
        gap: 13.5, // 18px → 13.5pt
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
    },

    stylesSchema: {
      sectionHeading: { title: "Section heading", description: "The uppercase, underlined label above each section (e.g. \"EXPERIENCE\")." },
      bulletListContainer: { title: "Bullet list", description: "The `<ul>` wrapper around a group of bullet points." },
      bulletItem: { title: "Bullet item", description: "One bullet point's row — marker plus text." },
      bulletMarker: { title: "Bullet marker", description: "The glyph in front of each bullet point." },
      entryTitle: { title: "Entry title", description: "An entry's main heading — a job title, a skill's name, a degree." },
      entrySubtitleMuted: { title: "Entry subtitle (muted)", description: "The smaller, greyed-out line under a skill/language/interest entry's title." },
      entryKeywordsMuted: { title: "Entry keywords (muted)", description: "A skill entry's trailing keyword list." },
      entrySkillBlock: { title: "Skill/language/interest entry", description: "The compact single-line layout used for Skills, Languages, and Interests." },
      entryRegularBlock: { title: "Regular entry", description: "The multi-line layout used for Work, Education, Projects, and the rest." },
      entryHeaderRow: { title: "Entry header row", description: "The row pairing an entry's title with its date range." },
      entryDate: { title: "Entry date", description: "The date range text, right-aligned in the header row." },
      entrySubtitleBlock: { title: "Entry subtitle", description: "The italic line under a regular entry's title — company, institution, or similar." },
      entryUrlLine: { title: "Entry URL line", description: "The small link line under an entry's subtitle." },
      entryScoreInline: { title: "Entry score (inline)", description: "A parenthetical score/grade appended after an education entry's subtitle." },
      entrySummary: { title: "Entry summary", description: "A regular entry's description paragraph." },
      entryLineGroupsContainer: { title: "Entry bullet groups", description: "Wraps an entry's responsibility/highlight bullet lists." },
      entryContainerTight: { title: "Entry spacing (tight)", description: "Vertical gap between entries in a Skills/Languages/Interests section." },
      entryContainerSpaced: { title: "Entry spacing (roomy)", description: "Vertical gap between entries in every other section." },
      section: { title: "Section", description: "One section's own wrapper (heading plus its entries)." },
      headerBox: { title: "Header block", description: "The centred name/headline/contact block at the top of the page." },
      headerName: { title: "Name (header)", description: "Your name, in large type at the top." },
      headerHeadline: { title: "Headline (header)", description: "The line under your name — your title or tagline." },
      contactPartsContainer: { title: "Contact line", description: "The row of contact details (email, phone, location, links)." },
      contactSeparator: { title: "Contact separator", description: "The \"|\" glyph between contact details." },
      summaryBlock: { title: "Summary", description: "Your professional summary paragraph." },
      bodyContainer: { title: "Body container", description: "The two-column row below the header." },
      mainColumn: { title: "Main column", description: "The wide column — Experience." },
      secondaryColumn: { title: "Side column", description: "The narrow column — every other section." },
      sectionsContainer: { title: "Main column sections", description: "Vertical stack of the main column's sections." },
      sectionsContainerSecondary: { title: "Side column sections", description: "Vertical stack of the side column's sections." },
    },

    blocksSchema: {
      sectionHeading: { title: "Section heading", description: "Renders a section's title label." },
      bulletList: { title: "Bullet list", description: "Renders a group of bullet points as a `<ul>`." },
      bulletItem: { title: "Bullet item", description: "Renders one bullet point — marker plus text." },
      entryBlock: { title: "Entry", description: "Renders one section entry, its layout branching by kind (skill vs. work vs. education, ...)." },
      entryKeyword: { title: "Entry keyword", description: "Renders one keyword in a skill entry's trailing list." },
      section: { title: "Section", description: "Renders one section: its heading plus every entry in it." },
      contactPart: { title: "Contact part", description: "Renders one piece of the header's contact line." },
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
                // Not "p": this container is laid out with flex/gap, which
                // only applies to block-level elements, not inline text.
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
          if: "$data.summary",
          then: {
            tag: "p",
            styles: "summaryBlock",
            children: [{ text: "$data.summary" }],
          },
        },
        {
          tag: "div",
          styles: "bodyContainer",
          children: [
            {
              tag: "div",
              styles: "mainColumn",
              children: [
                {
                  repeat: {
                    block: "section",
                    for: "$data.sections",
                    as: { section: "$item" },
                    tag: "div",
                    styles: "sectionsContainer",
                    filter: { field: "$item.kind", op: "in", value: ["work"] },
                    id: "mainSectionsRepeat",
                  },
                },
              ],
            },
            {
              tag: "aside",
              styles: "secondaryColumn",
              children: [
                {
                  repeat: {
                    block: "section",
                    for: "$data.sections",
                    as: { section: "$item" },
                    tag: "div",
                    styles: "sectionsContainerSecondary",
                    filter: { field: "$item.kind", op: "not-in", value: ["work"] },
                    id: "secondarySectionsRepeat",
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  })
