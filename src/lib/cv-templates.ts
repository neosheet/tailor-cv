import { batch1DemoTemplateDefinition } from "@/lib/cv-template-defs/batch1-demo"
import { classicTemplateDefinition } from "@/lib/cv-template-defs/classic"
import { twoColumnTemplateDefinition } from "@/lib/cv-template-defs/two-column"
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
    density: "Balanced",
    atsSafe: true,
    bestFor: "Most applications, and anything going through a job portal",
  },
  {
    id: "two-column",
    name: "Two Column",
    description:
      "A centred header over a two-column body: Experience leads in a wide main column, everything else sits in a compact side column.",
    definition: twoColumnTemplateDefinition,
    density: "Balanced",
    atsSafe: false,
    bestFor: "Design-forward applications reviewed by a person rather than parsed by a bot",
  },
  {
    id: "batch1-demo",
    name: "Batch 1 Demo (interpolation + merge)",
    description:
      "Classic, but the intro line uses string interpolation and the Skills section renders as one merged, comma-separated sentence instead of a list — a live test surface for the two new template-engine capabilities, not a real layout choice.",
    definition: batch1DemoTemplateDefinition,
    density: "Balanced",
    atsSafe: false,
    bestFor: "Trying out Batch 1's template-engine changes against real data",
  },
]
