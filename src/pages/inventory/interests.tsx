import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function InterestsPage() {
  return <PoolPage page={inventoryPages.interests} kind="interest" />
}
