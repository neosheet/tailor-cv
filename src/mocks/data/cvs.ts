import type { SourceCv } from "../types"

/**
 * Saved (Persona, Template) pairings — see docs/specs/06-persona-cv-split.md.
 *
 * A CV owns no content and no layout of its own — it just points at an
 * existing Persona and an existing Template, named for easy reference. Only
 * one template exists today (`src/lib/cv-templates.ts`), so both rows use it.
 */
export const cvs: SourceCv[] = [
  {
    id: "cv-backend-classic",
    name: "Senior Backend — Nusantara (Classic)",
    personaId: "persona-backend",
    templateId: "classic",
    note: "First saved pairing for the baseline persona.",
  },
  {
    id: "cv-lead-classic",
    name: "Engineering Lead — Globex (Classic)",
    personaId: "persona-lead",
    templateId: "classic",
  },
]
