import { sharedBlocks } from "@/lib/cv-template-blocks"
import {
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/cv-template-schema"

/**
 * Ported from `components/cv/templates/classic.tsx` +
 * `contact-line.tsx` — centred header over full-width sections, the safe
 * default (docs/specs/05-cv-template-format.md, "Worked example").
 */
export const classicTemplateDefinition: TemplateDefinition =
  parseTemplateDefinition({
    schemaVersion: 1,
    id: "classic",
    name: "Classic",
    description:
      "A centred header over full-width sections. The safest choice when you don't know how the CV will be read.",
    pageSize: "A4 / Letter",
    density: "Balanced",
    atsSafe: true,
    bestFor: "Most applications, and anything going through a job portal",
    blocks: { ...sharedBlocks },
    root: {
      type: "box",
      style: { padding: "48px 56px", fontSize: 12.5, color: "#171717" },
      children: [
        {
          type: "box",
          tag: "header",
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            textAlign: "center",
          },
          children: [
            {
              type: "box",
              tag: "h1",
              style: {
                fontSize: 24,
                fontWeight: 700,
                letterSpacing: "-0.025em",
              },
              children: [{ type: "text", bind: "name" }],
            },
            {
              type: "if",
              bind: "headline",
              then: {
                type: "box",
                tag: "p",
                style: { fontSize: 13, color: "#525252" },
                children: [{ type: "text", bind: "headline" }],
              },
            },
            {
              type: "repeat",
              bind: "contactParts",
              as: "part",
              tag: "p",
              style: {
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "2px 8px",
                fontSize: 11,
                color: "#525252",
              },
              separator: {
                type: "text",
                literal: "·",
                style: { color: "#a3a3a3" },
              },
              child: { type: "text", bind: "part" },
            },
          ],
        },
        {
          type: "if",
          bind: "summary",
          then: {
            type: "box",
            tag: "p",
            style: {
              marginTop: 20,
              textAlign: "center",
              lineHeight: 1.625,
              color: "#404040",
            },
            children: [{ type: "text", bind: "summary" }],
          },
        },
        {
          type: "repeat",
          bind: "sections",
          as: "section",
          tag: "div",
          style: {
            marginTop: 28,
            display: "flex",
            flexDirection: "column",
            gap: 24,
          },
          child: { type: "ref", block: "section", with: { section: "section" } },
        },
      ],
    },
  })
