import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function PublicationsPage() {
  return <PoolPage page={inventoryPages.publications} kind="publication" />
}
