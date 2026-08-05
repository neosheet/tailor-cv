import { PageHeader } from "@/components/layout/page-header"
import { PoolPanel } from "@/components/inventory/pool-panel"
import { POOL_COLUMNS } from "@/components/inventory/pool-columns"
import { itemsOfKind, type ItemKind } from "@/mocks"
import type { NavPage } from "@/lib/navigation"

/**
 * A whole single-pool Inventory page: header, search, bulk bar, table.
 *
 * Every pool except Basics is exactly this — Basics is the one page holding
 * several pools, so it composes `PoolPanel` under tabs instead.
 */
export function PoolPage({ page, kind }: { page: NavPage; kind: ItemKind }) {
  const columns = POOL_COLUMNS[kind]

  if (!columns) {
    throw new Error(`No column config for pool "${kind}".`)
  }

  return (
    <>
      <PageHeader title={page.title} description={page.description} />
      <PoolPanel
        kind={kind}
        label={page.title}
        columns={columns}
        rows={itemsOfKind(kind)}
      />
    </>
  )
}
