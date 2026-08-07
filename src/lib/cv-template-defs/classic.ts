import { sharedBlocks } from "@/lib/cv-template-blocks"
import {
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/cv-template-schema"

/**
 * Classic template for spec 07 format. Ported from the spec-05 version:
 * centred header over full-width sections, the safe default.
 * Pixel values converted to points (× 0.75).
 */
export const classicTemplateDefinition: TemplateDefinition =
  parseTemplateDefinition({
    schemaVersion: 2,
    id: "classic",
    name: "Classic",
    description:
      "A centred header over full-width sections. The safest choice when you don't know how the CV will be read.",
    density: "Balanced",
    atsSafe: true,
    bestFor: "Most applications, and anything going through a job portal",

    page: {
      size: "A4",
      margin: 30, // 40px → 30pt (40 × 0.75)
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
        alignItems: "center",
        gap: 3, // 4px → 3pt
        textAlign: "center",
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
        flexWrap: "wrap",
        justifyContent: "center",
        rowGap: 1.5, // 2px → 1.5pt
        columnGap: 6, // 8px → 6pt
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
        textAlign: "center",
        lineHeight: 1.625,
        color: "#404040",
      },

      // Sections container
      sectionsContainer: {
        marginTop: 21, // 28px → 21pt
        display: "flex",
        flexDirection: "column",
        gap: 18, // 24px → 18pt
      },
    },

    blocks: { ...sharedBlocks },

    root: {
      tag: "div",
      style: { paddingVertical: 36, paddingHorizontal: 42 }, // 48px 56px → 36pt 42pt
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
                tag: "p",
                styles: "contactPartsContainer",
                separator: {
                  text: "·",
                  styles: "contactSeparator",
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
          repeat: {
            block: "section",
            for: "$data.sections",
            as: { section: "$item" },
            tag: "div",
            styles: "sectionsContainer",
          },
        },
      ],
    },
  })
