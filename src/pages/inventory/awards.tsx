import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function AwardsPage() {
  return <PoolPage page={inventoryPages.awards} kind="award" />
}
