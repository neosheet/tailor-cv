import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function VolunteerPage() {
  return <PoolPage page={inventoryPages.volunteer} kind="volunteer" />
}
