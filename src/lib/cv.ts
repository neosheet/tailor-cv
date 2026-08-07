import type { InventoryData } from "@/lib/inventory-store"
import { buildResumeDocument, type PersonaData, type ResumeDocument } from "@/lib/persona"
import { cvTemplates, type CvTemplate } from "@/lib/cv-templates"
import type { DbCv } from "@/mocks/types"

/**
 * The CV layer — a saved (Persona, Template) pairing. See
 * `docs/specs/06-persona-cv-split.md`. Selectors only: "New CV" stays
 * disabled, nothing in this pass creates one.
 */

export function allCvs(data: PersonaData): DbCv[] {
  return data.cvs
}

export function findCv(data: PersonaData, cvId: string): DbCv | undefined {
  return data.cvs.find((cv) => cv.id === cvId)
}

/**
 * Everything a print/preview page needs for one saved CV: the row itself,
 * its Persona resolved into a renderable document, and its Template. One
 * place to compose these instead of every call site doing it separately.
 */
export function resolveCv(
  persona: PersonaData,
  inventory: InventoryData,
  cvId: string
): { cv: DbCv; document: ResumeDocument; template: CvTemplate } | undefined {
  const cv = findCv(persona, cvId)
  if (!cv) {
    return undefined
  }

  const document = buildResumeDocument(persona, inventory, cv.personaId)
  const template =
    cvTemplates.find((candidate) => candidate.id === cv.templateId) ??
    cvTemplates[0]

  return { cv, document, template }
}
