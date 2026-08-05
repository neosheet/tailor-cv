import { PoolPage } from "@/components/inventory/pool-page"
import { inventoryPages } from "@/lib/navigation"

export function CertificatesPage() {
  return <PoolPage page={inventoryPages.certificates} kind="certificate" />
}
