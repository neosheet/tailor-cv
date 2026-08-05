import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function ReferencesPage() {
  return <PoolPage page={inventoryPages.references} kind="reference" />
}
