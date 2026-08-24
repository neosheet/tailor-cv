import { batch1DemoTemplateDefinition } from "@/lib/cv-template-defs/batch1-demo"
import { classicTemplateDefinition } from "@/lib/cv-template-defs/classic"
import { classicCompactTemplateDefinition } from "@/lib/cv-template-defs/classic-compact"
import { twoColumnTemplateDefinition } from "@/lib/cv-template-defs/two-column"
import type { TemplateDefinition } from "@/lib/cv-template-schema"
import type { DbCvTemplate, FieldVisibility } from "@/mocks/types"

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
  /**
   * This template's starting `cvPersonaSettings.fieldVisibility` — not an
   * enforced restriction, just where a CV lands right after picking this
   * template (initial setup or a later "change template" select), replacing
   * whatever visibility the previous template left behind. Undefined means
   * "show everything." See `setApplicationCvBase`.
   */
  defaultFieldVisibility?: FieldVisibility
}

const builtInTemplates: CvTemplate[] = [
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
    id: "classic-compact",
    name: "Classic (Compact Experience)",
    description:
      "Classic, but Experience entries start with just the job title, company, and dates — location, workplace type, employment type, and description hidden by default.",
    definition: classicCompactTemplateDefinition,
    density: "Balanced",
    atsSafe: true,
    bestFor: "Roles where a tighter, scan-friendly Experience section matters more than the full detail",
    defaultFieldVisibility: {
      work: { fields: ["location", "workplaceType", "employmentType", "summary"] },
    },
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
]

/**
 * Not a real layout choice — a live test surface for the template engine's
 * interpolation/merge capabilities. Kept out of `cvTemplates` (and so out of
 * the picker and `findTemplate`) so real users never see it; import
 * `batch1DemoTemplateDefinition` directly for ad hoc testing instead.
 */
export const batch1DemoTemplate: CvTemplate = {
  id: "batch1-demo",
  name: "Batch 1 Demo (interpolation + merge)",
  description:
    "Classic, but the intro line uses string interpolation and the Skills section renders as one merged, comma-separated sentence instead of a list — a live test surface for the two new template-engine capabilities, not a real layout choice.",
  definition: batch1DemoTemplateDefinition,
  density: "Balanced",
  atsSafe: false,
  bestFor: "Trying out Batch 1's template-engine changes against real data",
}

export const cvTemplates: CvTemplate[] = builtInTemplates

/**
 * Resolves a template id against the built-in registry first, then a
 * user's saved `cv_templates` rows — the combined lookup every call site
 * should use instead of `cvTemplates.find` directly, now that ids can come
 * from either source. See docs/specs/13-save-as-new-template.md.
 */
export function findTemplate(
  id: string,
  savedTemplates: DbCvTemplate[]
): CvTemplate | undefined {
  const builtIn = cvTemplates.find((candidate) => candidate.id === id)
  if (builtIn) return builtIn

  const saved = savedTemplates.find((candidate) => candidate.id === id)
  if (!saved) return undefined

  return {
    id: saved.id,
    name: saved.name,
    description: saved.description,
    definition: saved.definition,
    density: saved.definition.density,
    atsSafe: saved.definition.atsSafe,
    bestFor: saved.definition.bestFor,
  }
}

/** Built-ins first, then a user's saved templates — the combined option list. */
export function allTemplates(savedTemplates: DbCvTemplate[]): CvTemplate[] {
  return [
    ...cvTemplates,
    ...savedTemplates.map(
      (saved) =>
        ({
          id: saved.id,
          name: saved.name,
          description: saved.description,
          definition: saved.definition,
          density: saved.definition.density,
          atsSafe: saved.definition.atsSafe,
          bestFor: saved.definition.bestFor,
        }) satisfies CvTemplate
    ),
  ]
}
