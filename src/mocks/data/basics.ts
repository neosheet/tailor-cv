import type { SourceItem } from "../types"

/** Demo user id. Everything in the dataset belongs to this one account. */
export const USER_ID = "demo-user"

/**
 * The six Basics pools. Like every other pool these are over-supplied on purpose —
 * two names, three headlines, three summaries — because the point of the product is
 * that a CV picks between them.
 *
 * Five of the six are pick-one at CV level; `social` lets a CV show several.
 */

export const names: SourceItem[] = [
  {
    id: "name-full",
    title: "Arya Nugraha",
    tags: ["default"],
  },
  {
    id: "name-formal",
    title: "Arya Pradipta Nugraha",
    tags: ["formal", "academic"],
    note: "Matches passport and degree certificates. Use for anything that gets verified.",
  },
]

export const headlines: SourceItem[] = [
  {
    id: "headline-backend",
    title: "Principal Backend Engineer",
    tags: ["backend", "default"],
  },
  {
    id: "headline-platform",
    favorite: true,
    title: "Platform Engineering Lead",
    tags: ["platform", "leadership"],
  },
  {
    id: "headline-payments",
    title: "Staff Engineer, Payments & Ledger",
    tags: ["payments", "backend"],
    note: "Narrow — only use where the role is explicitly payments.",
  },
]

export const summaries: SourceItem[] = [
  {
    id: "summary-backend",
    title: "Backend-leaning",
    summary:
      "Backend and platform engineer with 14 years building payment, commerce, and " +
      "logistics systems for Southeast Asian markets. Happiest turning a fragile " +
      "monolith into services a team can actually operate.",
    tags: ["backend", "default"],
  },
  {
    id: "summary-leadership",
    title: "Leadership-leaning",
    summary:
      "Engineering leader with 14 years in high-throughput payments and logistics, " +
      "the last six spent building and mentoring platform teams of four to twelve. " +
      "I care most about leaving systems the next team can run without me.",
    tags: ["leadership", "platform"],
    note: "Wording borrowed from the Globex ad. Reword before sending elsewhere.",
  },
  {
    id: "summary-short",
    title: "Short form",
    summary:
      "Backend and platform engineer, 14 years across payments, commerce, and " +
      "logistics in Southeast Asia.",
    tags: ["compact"],
    note: "For the Compact template, where the summary competes with work history.",
  },
]

export const contacts: SourceItem[] = [
  {
    id: "contact-personal",
    title: "Personal",
    subtitle: "arya.nugraha@example.com",
    url: "https://aryanugraha.example.com",
    details: { phone: "+62 812 3456 7890", image: null },
    tags: ["default"],
  },
  {
    id: "contact-work",
    title: "Work",
    subtitle: "arya@lumbung.example.com",
    url: "https://aryanugraha.example.com",
    details: { phone: "+62 21 5555 0142", image: null },
    tags: ["work"],
    note: "Current employer's address — do not use while still employed there.",
  },
]

export const locations: SourceItem[] = [
  {
    id: "location-jakarta",
    title: "Jakarta",
    subtitle: "DKI Jakarta",
    details: { address: null, postalCode: "12190", countryCode: "ID" },
    tags: ["default"],
  },
  {
    id: "location-singapore",
    title: "Singapore",
    subtitle: "Central Region",
    details: { address: null, postalCode: "018956", countryCode: "SG" },
    tags: ["relocating"],
    note: "Aspirational — no PR yet. Only for roles that state relocation support.",
  },
]

export const socials: SourceItem[] = [
  {
    id: "social-github",
    title: "GitHub",
    subtitle: "aryanugraha",
    url: "https://github.com/aryanugraha",
    tags: ["engineering", "default"],
  },
  {
    id: "social-linkedin",
    title: "LinkedIn",
    subtitle: "aryanugraha",
    url: "https://linkedin.com/in/aryanugraha",
    tags: ["default"],
  },
  {
    id: "social-mastodon",
    title: "Mastodon",
    subtitle: "@arya@hachyderm.io",
    url: "https://hachyderm.io/@arya",
    tags: ["engineering"],
    note: "Mostly personal posting. Skip for conservative or finance employers.",
  },
]
