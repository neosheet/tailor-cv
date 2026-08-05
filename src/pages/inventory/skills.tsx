import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function SkillsPage() {
  return <PoolPage page={inventoryPages.skills} kind="skill" />
}
