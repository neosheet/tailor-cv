import { classicTemplateDefinition } from "@/lib/cv-template-defs/classic"
import {
  parseTemplateDefinition,
  type TemplateDefinition,
} from "@/lib/cv-template-schema"

/**
 * Identical layout to Classic — only `id`/`name`/`description` differ. The
 * distinction this template exists for lives outside `TemplateDefinition`
 * entirely (a template controls presentation only, per `cv-templates.ts`'s
 * docstring): `cv-templates.ts`'s registry entry attaches a
 * `defaultFieldVisibility` that hides Experience's location, workplace type,
 * employment type, and description the first time an application's CV is
 * set up with this template (see `setApplicationCvBase`). Nothing here
 * enforces that hiding — a CV can always re-reveal those fields from the CV
 * tab's Visibility settings afterward.
 */
export const classicCompactTemplateDefinition: TemplateDefinition =
  parseTemplateDefinition({
    ...classicTemplateDefinition,
    id: "classic-compact",
    name: "Classic (Compact Experience)",
    description:
      "Classic, but Experience entries start with just the job title, company, and dates — location, workplace type, employment type, and description hidden by default.",
  })
