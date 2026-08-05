import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function ProjectsPage() {
  return <PoolPage page={inventoryPages.projects} kind="project" />
}
