/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import type { TemplateSettings } from "@/lib/cv-template-schema"
import { parseCvSnapshot } from "@/lib/cv-snapshot"
import type {
  CvPersonaSettings,
  DbCv,
  DbPersonaItem,
  DbPersonaLine,
  DbPersonaSection,
} from "@/mocks/types"

/**
 * Fetches `personas`, `persona_sections`, `persona_items`, `persona_lines`,
 * and `cvs` for the signed-in user once per session and holds them in React
 * state. Mirrors `src/lib/inventory-store.tsx` exactly — see that file for
 * why the selectors that read this store stay synchronous.
 *
 * One combined store rather than a separate `CvStore`: a Persona and its
 * saved CVs are read together everywhere that matters ("Used in CVs",
 * `resolveCv`, `buildResumeDocument`), so splitting them would just mean
 * every CV-facing page mounts two contexts for no benefit — the same reason
 * `InventoryStore` already bundles four unrelated tables into one.
 */

/**
 * Schema-accurate — deliberately not `mocks/types.ts`'s `DbPersona`, which
 * carries a `deletedAt` field with no backing column (soft delete isn't
 * implemented for Personas). `DbPersonaSection`/`DbPersonaItem`/
 * `DbPersonaLine`/`DbCv` from `mocks/types.ts` are schema-accurate already
 * and reused as-is.
 */
export type DbPersona = {
  id: string
  userId: string
  name: string
  note: string | null
  tags: string[]
  favorite: boolean
  createdAt: string
  updatedAt: string
}

export type PersonaData = {
  personas: DbPersona[]
  personaSections: DbPersonaSection[]
  personaItems: DbPersonaItem[]
  personaLines: DbPersonaLine[]
  cvs: DbCv[]
}

export type PersonaStore = PersonaData & {
  userId: string | null
  loading: boolean
  error: Error | null
  refetch: () => void
  setPersonas: React.Dispatch<React.SetStateAction<DbPersona[]>>
  setPersonaSections: React.Dispatch<React.SetStateAction<DbPersonaSection[]>>
  setPersonaItems: React.Dispatch<React.SetStateAction<DbPersonaItem[]>>
  setPersonaLines: React.Dispatch<React.SetStateAction<DbPersonaLine[]>>
  setCvs: React.Dispatch<React.SetStateAction<DbCv[]>>
}

const PersonaStoreContext = React.createContext<PersonaStore | null>(null)

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught))
}

export function mapPersonaRow(row: Tables<"personas">): DbPersona {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    note: row.note,
    tags: row.tags,
    favorite: row.favorite,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapPersonaSectionRow(
  row: Tables<"persona_sections">
): DbPersonaSection {
  return {
    personaId: row.persona_id,
    kind: row.kind,
    position: row.position,
  }
}

export function mapPersonaItemRow(row: Tables<"persona_items">): DbPersonaItem {
  return {
    personaId: row.persona_id,
    itemId: row.item_id,
    position: row.position,
  }
}

export function mapPersonaLineRow(row: Tables<"persona_lines">): DbPersonaLine {
  return {
    personaId: row.persona_id,
    itemId: row.item_id,
    lineId: row.line_id,
    position: row.position,
  }
}

export function mapCvRow(row: Tables<"cvs">): DbCv {
  return {
    id: row.id,
    userId: row.user_id,
    personaId: row.persona_id,
    templateId: row.template_id,
    name: row.name,
    note: row.note,
    tags: row.tags,
    favorite: row.favorite,
    templateSettings: (row.template_settings ?? {}) as unknown as TemplateSettings,
    personaSettings: (row.persona_settings ?? {}) as unknown as CvPersonaSettings,
    snapshot: row.snapshot ? parseCvSnapshot(row.snapshot) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function fetchByPersonaIds<T>(
  table: "persona_sections" | "persona_items" | "persona_lines",
  personaIds: string[]
) {
  if (personaIds.length === 0) {
    return { data: [] as T[], error: null }
  }

  return supabase
    .from(table)
    .select("*")
    .in("persona_id", personaIds)
    .order("position") as unknown as Promise<{ data: T[] | null; error: unknown }>
}

export function PersonaStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [personas, setPersonas] = React.useState<DbPersona[]>([])
  const [personaSections, setPersonaSections] = React.useState<
    DbPersonaSection[]
  >([])
  const [personaItems, setPersonaItems] = React.useState<DbPersonaItem[]>([])
  const [personaLines, setPersonaLines] = React.useState<DbPersonaLine[]>([])
  const [cvs, setCvs] = React.useState<DbCv[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<Error | null>(null)
  const [version, setVersion] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!userId) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const { data: personaRows, error: personasError } = await supabase
          .from("personas")
          .select("*")
          .eq("user_id", userId as string)
          .order("created_at")

        if (personasError) throw personasError

        const personaIds = (personaRows ?? []).map((row) => row.id)

        const [sectionsResult, itemsResult, linesResult, cvsResult] =
          await Promise.all([
            fetchByPersonaIds<Tables<"persona_sections">>(
              "persona_sections",
              personaIds
            ),
            fetchByPersonaIds<Tables<"persona_items">>(
              "persona_items",
              personaIds
            ),
            fetchByPersonaIds<Tables<"persona_lines">>(
              "persona_lines",
              personaIds
            ),
            supabase
              .from("cvs")
              .select("*")
              .eq("user_id", userId as string)
              .order("created_at"),
          ])

        if (sectionsResult.error) throw sectionsResult.error
        if (itemsResult.error) throw itemsResult.error
        if (linesResult.error) throw linesResult.error
        if (cvsResult.error) throw cvsResult.error

        if (cancelled) return

        setPersonas((personaRows ?? []).map(mapPersonaRow))
        setPersonaSections((sectionsResult.data ?? []).map(mapPersonaSectionRow))
        setPersonaItems((itemsResult.data ?? []).map(mapPersonaItemRow))
        setPersonaLines((linesResult.data ?? []).map(mapPersonaLineRow))
        setCvs((cvsResult.data ?? []).map(mapCvRow))
      } catch (caught) {
        if (!cancelled) {
          setError(toError(caught))
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [userId, version])

  const refetch = React.useCallback(() => setVersion((v) => v + 1), [])

  const value = React.useMemo<PersonaStore>(
    () => ({
      personas,
      personaSections,
      personaItems,
      personaLines,
      cvs,
      userId,
      loading,
      error,
      refetch,
      setPersonas,
      setPersonaSections,
      setPersonaItems,
      setPersonaLines,
      setCvs,
    }),
    [
      personas,
      personaSections,
      personaItems,
      personaLines,
      cvs,
      userId,
      loading,
      error,
      refetch,
    ]
  )

  return (
    <PersonaStoreContext.Provider value={value}>
      {children}
    </PersonaStoreContext.Provider>
  )
}

export function usePersonaStore(): PersonaStore {
  const context = React.useContext(PersonaStoreContext)

  if (!context) {
    throw new Error("usePersonaStore must be used within a PersonaStoreProvider")
  }

  return context
}
