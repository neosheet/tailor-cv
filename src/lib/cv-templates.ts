import { AcademicTemplate } from "@/components/cv/templates/academic"
import { ClassicTemplate } from "@/components/cv/templates/classic"
import { CompactTemplate } from "@/components/cv/templates/compact"
import { SidebarTemplate } from "@/components/cv/templates/sidebar"
import type { ResumeDocument } from "@/mocks/cv"

/**
 * Available print layouts for rendering a CV.
 *
 * A template controls presentation only — page geometry, columns, type scale.
 * It never affects which entries or bullet points a CV includes; that stays a
 * property of the CV's selection from the Inventory (see spec 01).
 *
 * **This list is the single source of truth.** Each entry carries its own
 * component, so there is no second list to keep in sync, and the order here is
 * what "the first template" means — including for the unknown-id fallback.
 */
export type TemplateComponent = (props: {
  document: ResumeDocument
}) => React.ReactNode

export type CvTemplate = {
  id: string
  name: string
  description: string
  /** The component that renders it. */
  component: TemplateComponent
  /** Print page geometry the template is designed against. */
  pageSize: "A4" | "A4 / Letter"
  /** Roughly how much content fits before spilling to a second page. */
  density: "Roomy" | "Balanced" | "Dense"
  /** Whether the layout survives automated resume parsers. */
  atsSafe: boolean
  /** Who this layout suits — shown as the "best for" line. */
  bestFor: string
}

export const cvTemplates: CvTemplate[] = [
  {
    id: "classic",
    name: "Classic",
    description:
      "A centred header over full-width sections. The safest choice when you don't know how the CV will be read.",
    component: ClassicTemplate,
    pageSize: "A4 / Letter",
    density: "Balanced",
    atsSafe: true,
    bestFor: "Most applications, and anything going through a job portal",
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description:
      "Contact details, skills, and languages in a left rail; work and education fill the main column.",
    component: SidebarTemplate,
    pageSize: "A4",
    density: "Balanced",
    atsSafe: false,
    bestFor: "Design and product roles where the CV is read by a human first",
  },
  {
    id: "compact",
    name: "Compact",
    description:
      "Tighter leading and a smaller type scale, so a long history still lands on a single page.",
    component: CompactTemplate,
    pageSize: "A4 / Letter",
    density: "Dense",
    atsSafe: true,
    bestFor: "Ten-plus years of history you don't want to cut",
  },
  {
    id: "academic",
    name: "Academic",
    description:
      "Wide margins and generous spacing, ordered to put publications and education above work.",
    component: AcademicTemplate,
    pageSize: "A4",
    density: "Roomy",
    atsSafe: true,
    bestFor: "Research posts, grants, and academic applications",
  },
]
