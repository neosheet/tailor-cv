import {
  AtSignIcon,
  AwardIcon,
  BadgeCheckIcon,
  BookIcon,
  BookOpenIcon,
  BookmarkIcon,
  BriefcaseIcon,
  Building2Icon,
  BuildingIcon,
  CalendarIcon,
  ClipboardListIcon,
  ClockIcon,
  FolderIcon,
  GaugeIcon,
  GlobeIcon,
  GraduationCapIcon,
  HeartIcon,
  HomeIcon,
  ImageIcon,
  LanguagesIcon,
  LinkIcon,
  MailboxIcon,
  MapIcon,
  MapPinIcon,
  MegaphoneIcon,
  PercentIcon,
  PhoneIcon,
  QuoteIcon,
  Share2Icon,
  TagIcon,
  TextIcon,
  UserIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"

import type { ItemKind, LineKind } from "@/lib/inventory"

/**
 * Per-`ItemKind` field/label/line-kind configuration, per the field mapping
 * in `docs/specs/02-inventory-data-model.md`. One source of truth, shared by
 * the item form (`item-dialog.tsx`), the read-only detail view
 * (`item-detail-dialog.tsx`'s `summary` label), and the pool table's
 * nested-list column (`pool-columns.tsx`'s `linesColumn` calls) — those three
 * previously kept their own independently hand-maintained slice of the same
 * per-kind knowledge.
 */

export type FieldKey =
  | "title"
  | "subtitle"
  | "summary"
  | "url"
  | "phone"
  | "image"
  | "address"
  | "postalCode"
  | "countryCode"
  | "startDate"
  | "endDate"
  | "yearsExperience"
  | "studyType"
  | "score"
  | "entity"
  | "type"
  | "employmentType"
  | "workplaceType"
  | "location"

export type FieldConfig = {
  key: FieldKey
  label: string
  /** Undefined/absent renders a plain single-line text input. */
  kind?: "multiline" | "date" | "number"
  icon: LucideIcon
}

/** Which fields each kind shows, in order, per the spec's field mapping. */
export const KIND_FIELDS: Record<ItemKind, FieldConfig[]> = {
  name: [{ key: "title", label: "Full name", icon: UserIcon }],
  headline: [{ key: "title", label: "Headline", icon: MegaphoneIcon }],
  summary: [
    { key: "title", label: "Label", icon: BookmarkIcon },
    { key: "summary", label: "Summary", kind: "multiline", icon: TextIcon },
  ],
  contact: [
    { key: "title", label: "Label", icon: BookmarkIcon },
    { key: "subtitle", label: "Email", icon: AtSignIcon },
    { key: "url", label: "Website", icon: LinkIcon },
    { key: "phone", label: "Phone", icon: PhoneIcon },
    { key: "image", label: "Photo URL", icon: ImageIcon },
  ],
  location: [
    { key: "title", label: "City", icon: MapPinIcon },
    { key: "subtitle", label: "Region", icon: MapIcon },
    { key: "address", label: "Address", icon: HomeIcon },
    { key: "postalCode", label: "Postal code", icon: MailboxIcon },
    { key: "countryCode", label: "Country code", icon: GlobeIcon },
  ],
  social: [
    { key: "title", label: "Network", icon: Share2Icon },
    { key: "subtitle", label: "Username", icon: UserIcon },
    { key: "url", label: "Profile URL", icon: LinkIcon },
  ],

  work: [
    { key: "title", label: "Company", icon: Building2Icon },
    { key: "subtitle", label: "Position", icon: BriefcaseIcon },
    { key: "url", label: "Company website", icon: LinkIcon },
    { key: "summary", label: "Description", kind: "multiline", icon: TextIcon },
    { key: "employmentType", label: "Employment type", icon: ClipboardListIcon },
    { key: "workplaceType", label: "Workplace type", icon: HomeIcon },
    { key: "location", label: "Location", icon: MapPinIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  volunteer: [
    { key: "title", label: "Organisation", icon: BuildingIcon },
    { key: "subtitle", label: "Position", icon: BriefcaseIcon },
    { key: "summary", label: "Description", kind: "multiline", icon: TextIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  education: [
    { key: "title", label: "Institution", icon: GraduationCapIcon },
    { key: "subtitle", label: "Area", icon: BookOpenIcon },
    { key: "studyType", label: "Study type", icon: ClipboardListIcon },
    { key: "score", label: "Score", icon: PercentIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  skill: [
    { key: "title", label: "Skill name", icon: WrenchIcon },
    { key: "subtitle", label: "Level", icon: GaugeIcon },
    {
      key: "yearsExperience",
      label: "Years of experience",
      kind: "number",
      icon: ClockIcon,
    },
  ],
  language: [
    { key: "title", label: "Language", icon: LanguagesIcon },
    { key: "subtitle", label: "Fluency", icon: GaugeIcon },
  ],
  interest: [{ key: "title", label: "Interest", icon: HeartIcon }],
  project: [
    { key: "title", label: "Project name", icon: FolderIcon },
    { key: "summary", label: "Description", kind: "multiline", icon: TextIcon },
    { key: "entity", label: "Entity", icon: Building2Icon },
    { key: "type", label: "Type", icon: TagIcon },
    { key: "startDate", label: "Start date", kind: "date", icon: CalendarIcon },
    { key: "endDate", label: "End date", kind: "date", icon: CalendarIcon },
  ],
  award: [
    { key: "title", label: "Award title", icon: AwardIcon },
    { key: "subtitle", label: "Awarder", icon: BuildingIcon },
    { key: "summary", label: "Summary", kind: "multiline", icon: TextIcon },
    { key: "startDate", label: "Awarded", kind: "date", icon: CalendarIcon },
    { key: "url", label: "Link", icon: LinkIcon },
  ],
  certificate: [
    { key: "title", label: "Certificate name", icon: BadgeCheckIcon },
    { key: "subtitle", label: "Issuer", icon: BuildingIcon },
    { key: "url", label: "Credential URL", icon: LinkIcon },
    { key: "startDate", label: "Issued", kind: "date", icon: CalendarIcon },
  ],
  publication: [
    { key: "title", label: "Publication title", icon: BookIcon },
    { key: "subtitle", label: "Publisher", icon: BuildingIcon },
    { key: "summary", label: "Summary", kind: "multiline", icon: TextIcon },
    { key: "startDate", label: "Released", kind: "date", icon: CalendarIcon },
  ],
  reference: [
    { key: "title", label: "Name", icon: UserIcon },
    { key: "subtitle", label: "Role", icon: BriefcaseIcon },
    { key: "summary", label: "Reference", kind: "multiline", icon: QuoteIcon },
  ],
}

/** Which `LineKind`s each kind shows, in the fixed order every dialog uses. */
export const KIND_LINE_KINDS: Partial<Record<ItemKind, LineKind[]>> = {
  work: ["responsibilities", "highlights"],
  volunteer: ["responsibilities", "highlights"],
  education: ["courses"],
  skill: ["keywords"],
  interest: ["keywords"],
  project: ["highlights", "keywords", "roles"],
}

/** Only these three kinds get the "Skills used" picker, per spec 02. */
export const SKILL_LINK_KINDS: readonly ItemKind[] = ["work", "volunteer", "project"]

/** Lowercased so it reads naturally in "Add {label}" / "Edit {label}". */
export const KIND_LABELS: Record<ItemKind, string> = {
  name: "name",
  headline: "headline",
  summary: "summary",
  contact: "contact",
  location: "location",
  social: "social",

  work: "work entry",
  volunteer: "volunteer entry",
  education: "education entry",
  skill: "skill",
  language: "language",
  interest: "interest",
  project: "project",
  award: "award",
  certificate: "certificate",
  publication: "publication",
  reference: "reference",
}
