import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function WorkPage() {
  return <PoolPage page={inventoryPages.work} kind="work" />
}
