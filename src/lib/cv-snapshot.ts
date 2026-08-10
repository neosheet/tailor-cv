import { z } from "zod"

import {
  templateDefinitionSchema,
  templateSettingsSchema,
  type TemplateDefinition,
  type TemplateSettings,
} from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/resume-document"
import type { CvTemplate } from "@/lib/cv-templates"
import type { DbCv } from "@/mocks/types"

/**
 * A CV rendered down to data — see docs/specs/09-cv-export-import.md. Used
 * for both file export/import and, later, an Application's frozen CV copy.
 */
export type CvSnapshotV1 = {
  formatVersion: 1
  exportedAt: string // ISO timestamp
  name: string
  note: string | null
  tags: string[]
  document: ResumeDocument
  template: TemplateDefinition
  templateSettings: TemplateSettings
}

// `document` is validated loosely rather than with a schema mirroring
// `ResumeDocument`'s full nested shape: it's always produced by our own
// `buildResumeDocument` on export, never hand-authored, so the strict-schema
// cost (many optional/nested fields, `ItemKind`/`LineKind` unions) buys no
// real safety here — cast through the TS type at the boundary instead.
const resumeDocumentSchema = z.record(z.string(), z.unknown()) as unknown as z.ZodType<ResumeDocument>

export const cvSnapshotV1Schema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  tags: z.array(z.string()),
  document: resumeDocumentSchema,
  template: templateDefinitionSchema,
  templateSettings: templateSettingsSchema,
})

export function buildCvSnapshot(
  cv: DbCv,
  document: ResumeDocument,
  template: CvTemplate
): CvSnapshotV1 {
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    name: cv.name,
    note: cv.note,
    tags: cv.tags,
    document,
    template: template.definition,
    templateSettings: cv.templateSettings,
  }
}

/**
 * Parses and validates a `CvSnapshotV1` at the point it's authored (on
 * export) or read back in (on import) — mirrors `parseTemplateDefinition`'s
 * error-join pattern (`cv-template-schema.ts`). An unrecognized
 * `formatVersion` fails `z.literal(1)` and surfaces here as a normal,
 * readable issue rather than a generic zod dump.
 */
export function parseCvSnapshot(input: unknown): CvSnapshotV1 {
  const result = cvSnapshotV1Schema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ")
    throw new Error(`Invalid CV snapshot: ${issues}`)
  }
  return result.data as CvSnapshotV1
}

export function templateFromSnapshot(snapshot: CvSnapshotV1): CvTemplate {
  return {
    id: snapshot.template.id,
    name: snapshot.template.name,
    description: snapshot.template.description,
    definition: snapshot.template,
    density: snapshot.template.density,
    atsSafe: snapshot.template.atsSafe,
    bestFor: snapshot.template.bestFor,
  }
}
