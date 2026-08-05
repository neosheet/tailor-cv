import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function LanguagesPage() {
  return <PoolPage page={inventoryPages.languages} kind="language" />
}
