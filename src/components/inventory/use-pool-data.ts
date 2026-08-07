import { POOL_COLUMNS } from "@/components/inventory/pool-columns"
import type { PoolColumn } from "@/components/inventory/pool-table"
import { itemsOfKind, type DbInventoryItem, type ItemKind } from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"

export type PoolData = {
  columns: PoolColumn[]
  rows: DbInventoryItem[]
  loading: boolean
  error: Error | null
}

/**
 * The columns+rows lookup a real Inventory pool page needs — shared with
 * `PoolPickerDialog` so both read the same table the same way instead of
 * duplicating the lookup.
 */
export function usePoolData(kind: ItemKind): PoolData {
  const store = useInventoryStore()

  return {
    columns: POOL_COLUMNS[kind],
    rows: itemsOfKind(store, kind),
    loading: store.loading,
    error: store.error,
  }
}
