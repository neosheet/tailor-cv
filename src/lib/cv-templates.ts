import { classicTemplateDefinition } from "@/lib/cv-template-defs/classic"
import type { TemplateDefinition } from "@/lib/cv-template-schema"

/**
 * Available print layouts for rendering a CV.
 *
 * A template controls presentation only — page geometry, columns, type scale.
 * It never affects which entries or bullet points a CV includes; that stays a
 * property of the CV's selection from the Inventory (see spec 01).
 *
 * **This list is the single source of truth.** Each entry carries its own
 * definition, so there is no second list to keep in sync, and the order here
 * is what "the first template" means — including for the unknown-id fallback.
 */
export type CvTemplate = {
  id: string
  name: string
  description: string
  /** The JSON layout `TemplateNodeRenderer` interprets to render it. */
  definition: TemplateDefinition
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
    definition: classicTemplateDefinition,
    pageSize: "A4 / Letter",
    density: "Balanced",
    atsSafe: true,
    bestFor: "Most applications, and anything going through a job portal",
  },
]
