/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

import { useAuth } from "@/lib/auth-context"
import { supabase } from "@/lib/supabase"
import type { Tables } from "@/lib/database.types"
import type { DbInventoryItem, DbInventoryLine, DbItemSkill } from "@/mocks/types"

/**
 * Fetches `inventory_items`, `inventory_lines`, `item_skills`, and `tags` for
 * the signed-in user once per session and holds them in React state, shaped
 * like the old `mockDb`. See `src/lib/inventory.ts` for why the selectors that
 * read this store stay synchronous instead of calling Supabase directly.
 */

export type InventoryData = {
  items: DbInventoryItem[]
  lines: DbInventoryLine[]
  itemSkills: DbItemSkill[]
}

export type SkillCategory = {
  id: string
  name: string
  position: number
}

export type InventoryStore = InventoryData & {
  /** The tag registry — names only, mirroring `mocks/tags.ts`'s in-memory list. */
  tags: string[]
  /** The skill category registry — FK rows, unlike `tags`' flat name array. */
  skillCategories: SkillCategory[]
  /** Null until auth resolves; mutators need this to scope their writes. */
  userId: string | null
  loading: boolean
  error: Error | null
  refetch: () => void
  setItems: React.Dispatch<React.SetStateAction<DbInventoryItem[]>>
  setLines: React.Dispatch<React.SetStateAction<DbInventoryLine[]>>
  setItemSkills: React.Dispatch<React.SetStateAction<DbItemSkill[]>>
  setTags: React.Dispatch<React.SetStateAction<string[]>>
  setSkillCategories: React.Dispatch<React.SetStateAction<SkillCategory[]>>
}

const InventoryStoreContext = React.createContext<InventoryStore | null>(null)

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught))
}

export function mapItemRow(row: Tables<"inventory_items">): DbInventoryItem {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    summary: row.summary,
    url: row.url,
    startDate: row.start_date,
    endDate: row.end_date,
    details: (row.details ?? {}) as Record<string, unknown>,
    yearsExperience: row.years_experience,
    categoryId: row.category_id,
    tags: row.tags,
    note: row.note,
    favorite: row.favorite,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapLineRow(row: Tables<"inventory_lines">): DbInventoryLine {
  return {
    id: row.id,
    itemId: row.item_id,
    listKind: row.list_kind,
    content: row.content,
    tags: row.tags,
    note: row.note,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapItemSkillRow(row: Tables<"item_skills">): DbItemSkill {
  return {
    itemId: row.item_id,
    skillId: row.skill_id,
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapSkillCategoryRow(row: Tables<"skill_categories">): SkillCategory {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
  }
}

async function fetchLinesForItems(itemIds: string[]) {
  if (itemIds.length === 0) {
    return { data: [] as Tables<"inventory_lines">[], error: null }
  }

  return supabase
    .from("inventory_lines")
    .select("*")
    .in("item_id", itemIds)
    .order("position")
}

async function fetchSkillsForItems(itemIds: string[]) {
  if (itemIds.length === 0) {
    return { data: [] as Tables<"item_skills">[], error: null }
  }

  return supabase
    .from("item_skills")
    .select("*")
    .in("item_id", itemIds)
    .order("position")
}

export function InventoryStoreProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { session } = useAuth()
  const userId = session?.user.id ?? null

  const [items, setItems] = React.useState<DbInventoryItem[]>([])
  const [lines, setLines] = React.useState<DbInventoryLine[]>([])
  const [itemSkills, setItemSkills] = React.useState<DbItemSkill[]>([])
  const [tags, setTags] = React.useState<string[]>([])
  const [skillCategories, setSkillCategories] = React.useState<SkillCategory[]>([])
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
        const { data: itemRows, error: itemsError } = await supabase
          .from("inventory_items")
          .select("*")
          .eq("user_id", userId as string)
          .order("position")

        if (itemsError) throw itemsError

        const itemIds = (itemRows ?? []).map((row) => row.id)

        const [linesResult, skillsResult, tagsResult, categoriesResult] = await Promise.all([
          fetchLinesForItems(itemIds),
          fetchSkillsForItems(itemIds),
          supabase
            .from("tags")
            .select("*")
            .eq("user_id", userId as string)
            .order("name"),
          supabase
            .from("skill_categories")
            .select("*")
            .eq("user_id", userId as string)
            .order("name"),
        ])

        if (linesResult.error) throw linesResult.error
        if (skillsResult.error) throw skillsResult.error
        if (tagsResult.error) throw tagsResult.error
        if (categoriesResult.error) throw categoriesResult.error

        if (cancelled) return

        setItems((itemRows ?? []).map(mapItemRow))
        setLines((linesResult.data ?? []).map(mapLineRow))
        setItemSkills((skillsResult.data ?? []).map(mapItemSkillRow))
        setTags((tagsResult.data ?? []).map((row) => row.name))
        setSkillCategories((categoriesResult.data ?? []).map(mapSkillCategoryRow))
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

  const value = React.useMemo<InventoryStore>(
    () => ({
      items,
      lines,
      itemSkills,
      tags,
      skillCategories,
      userId,
      loading,
      error,
      refetch,
      setItems,
      setLines,
      setItemSkills,
      setTags,
      setSkillCategories,
    }),
    [items, lines, itemSkills, tags, skillCategories, userId, loading, error, refetch]
  )

  return (
    <InventoryStoreContext.Provider value={value}>
      {children}
    </InventoryStoreContext.Provider>
  )
}

export function useInventoryStore(): InventoryStore {
  const context = React.useContext(InventoryStoreContext)

  if (!context) {
    throw new Error(
      "useInventoryStore must be used within an InventoryStoreProvider"
    )
  }

  return context
}
