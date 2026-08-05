import type { SourceCv } from "../types"

/**
 * Two CVs built from the same Inventory.
 *
 * They exist to prove the product's central claim. Both draw on the same ten
 * jobs and the same bullets underneath them; what differs is which four jobs
 * they select, which bullets within those jobs, which headline and summary, and
 * the order of the sections. Rendered side by side they should read as two
 * genuinely different résumés, with not one word of text duplicated between
 * them in the database.
 *
 * Line selection is by tag rather than by id — see `SourceCvLines`.
 */
export const cvs: SourceCv[] = [
  {
    id: "cv-backend",
    name: "Senior Backend — Nusantara",
    note: "Baseline CV. Start here and trim for the specific role.",
    sections: [
      { kind: "name", items: [{ itemId: "name-full" }] },
      { kind: "headline", items: [{ itemId: "headline-backend" }] },
      { kind: "summary", items: [{ itemId: "summary-backend" }] },
      { kind: "contact", items: [{ itemId: "contact-personal" }] },
      { kind: "location", items: [{ itemId: "location-jakarta" }] },
      {
        kind: "social",
        items: [{ itemId: "social-github" }, { itemId: "social-linkedin" }],
      },
      {
        kind: "work",
        items: [
          {
            itemId: "work-lumbung",
            lines: { tagsAny: ["backend", "performance", "architecture"] },
          },
          {
            itemId: "work-nusantara",
            lines: { tagsAny: ["backend", "payments", "reliability"] },
          },
          {
            itemId: "work-kirana-senior",
            lines: { tagsAny: ["backend", "performance", "commerce"] },
          },
          {
            itemId: "work-sinar",
            lines: { tagsAny: ["backend", "logistics"] },
          },
        ],
      },
      {
        kind: "skill",
        items: [
          { itemId: "skill-go", lines: "all" },
          { itemId: "skill-postgres", lines: "all" },
          { itemId: "skill-kafka", lines: "all" },
          { itemId: "skill-redis", lines: "none" },
          { itemId: "skill-kubernetes", lines: "none" },
          { itemId: "skill-observability", lines: "none" },
        ],
      },
      {
        kind: "project",
        items: [
          {
            itemId: "proj-arus",
            lines: { tagsAny: ["performance", "opensource"] },
          },
          { itemId: "proj-pantau", lines: { tagsAny: ["performance"] } },
        ],
      },
      { kind: "education", items: [{ itemId: "edu-uid", lines: "none" }] },
      {
        kind: "language",
        items: [{ itemId: "lang-id" }, { itemId: "lang-en" }],
      },
    ],
  },

  {
    id: "cv-lead",
    name: "Engineering Lead — Globex",
    note: "Leadership framing. Skills moved below Work — the story is the teams, not the stack.",
    sections: [
      { kind: "name", items: [{ itemId: "name-full" }] },
      { kind: "headline", items: [{ itemId: "headline-platform" }] },
      { kind: "summary", items: [{ itemId: "summary-leadership" }] },
      { kind: "contact", items: [{ itemId: "contact-personal" }] },
      { kind: "location", items: [{ itemId: "location-jakarta" }] },
      { kind: "social", items: [{ itemId: "social-linkedin" }] },
      {
        kind: "work",
        items: [
          {
            itemId: "work-lumbung",
            lines: { tagsAny: ["leadership", "mentoring", "hiring"] },
          },
          {
            itemId: "work-nusantara",
            lines: { tagsAny: ["leadership", "mentoring", "reliability"] },
          },
          {
            itemId: "work-kirana-senior",
            lines: { tagsAny: ["leadership", "mentoring"] },
          },
        ],
      },
      {
        kind: "volunteer",
        items: [
          {
            itemId: "vol-kodekita",
            lines: { tagsAny: ["teaching", "leadership"] },
          },
        ],
      },
      {
        kind: "skill",
        items: [
          { itemId: "skill-go", lines: "none" },
          { itemId: "skill-kubernetes", lines: "none" },
          { itemId: "skill-observability", lines: "none" },
        ],
      },
      { kind: "education", items: [{ itemId: "edu-uid", lines: "none" }] },
      {
        kind: "language",
        items: [{ itemId: "lang-id" }, { itemId: "lang-en" }],
      },
    ],
  },
]
