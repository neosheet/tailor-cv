import { cvTemplates } from "@/lib/cv-templates"
import type { ResumeDocument } from "@/mocks/cv"

/**
 * Renders a CV under the template `templateId` names.
 *
 * **Unknown ids fall back to the first template in `cvTemplates`** rather than a
 * hardcoded one. A CV stores no template (spec 03), so an id here comes from a
 * preview picker or, later, an application — and either can name a template a
 * build has since renamed or removed. The list always has at least one entry, so
 * the first is always a valid answer, and reordering the list moves the default
 * with it.
 *
 * Rendering `<template.component>` off the entry keeps `cvTemplates` the single
 * source of truth: no switch to fall out of sync, and no component assigned to a
 * local during render.
 */
export function TemplateRender({
  templateId,
  document,
}: {
  templateId: string
  document: ResumeDocument
}) {
  const template =
    cvTemplates.find((candidate) => candidate.id === templateId) ??
    cvTemplates[0]

  return <template.component document={document} />
}
