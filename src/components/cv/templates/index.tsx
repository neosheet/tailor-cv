import { TemplateNodeRenderer } from "@/components/cv/template-node-renderer"
import { cvTemplates, findTemplate } from "@/lib/cv-templates"
import type { TemplateDefinition, TemplateSettings } from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/persona"
import type { DbCvTemplate } from "@/mocks/types"

/**
 * Renders a CV under the template `templateId` names — or, when `definition`
 * is passed, that inlined `TemplateDefinition` directly, bypassing the
 * `cvTemplates` registry lookup entirely. A frozen/imported CV's inlined
 * definition has no guarantee its `id` matches a registered template, so it
 * must never fall through the unknown-id fallback below (that would silently
 * render the wrong template).
 *
 * **Unknown ids fall back to the first template in `cvTemplates`** rather than a
 * hardcoded one — but only on the `templateId` path. A CV stores no template
 * (spec 03), so an id here comes from a preview picker or, later, an
 * application — and either can name a template a build has since renamed or
 * removed. The list always has at least one entry, so the first is always a
 * valid answer, and reordering the list moves the default with it.
 *
 * Rendering via `TemplateNodeRenderer` off the entry's `definition` keeps
 * `cvTemplates` the single source of truth: no switch to fall out of sync, and
 * no component assigned to a local during render.
 */
export function TemplateRender({
  templateId,
  definition,
  document,
  settings,
  savedTemplates = [],
    ref
}: {
  templateId: string
  /** Renders this definition directly when set, skipping the registry lookup. */
  definition?: TemplateDefinition
  document: ResumeDocument
  settings?: TemplateSettings
  /** A user's saved (Save-as-new-template) rows — checked when `templateId` isn't a built-in. */
  savedTemplates?: DbCvTemplate[]
    ref?: React.Ref<HTMLDivElement>
}) {
  const resolvedDefinition =
    definition ??
    (findTemplate(templateId, savedTemplates) ?? cvTemplates[0]).definition

  return (
    <TemplateNodeRenderer
      ref={ref}
      definition={resolvedDefinition}
      context={document}
      settings={settings}
    />
  )
}
