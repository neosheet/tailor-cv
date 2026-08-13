import { PageHeader } from "@/components/layout/page-header"
import { PoolPanel } from "@/components/inventory/pool-panel"
import { PoolTableSkeleton } from "@/components/inventory/pool-table-skeleton"
import { usePoolData } from "@/components/inventory/use-pool-data"
import type { ItemKind } from "@/lib/inventory"
import type { NavPage } from "@/lib/navigation"

/**
 * A whole single-pool Inventory page: header, search, bulk bar, table.
 *
 * Every pool except Basics is exactly this — Basics is the one page holding
 * several pools, so it composes `PoolPanel` under tabs instead.
 */
export function PoolPage({ page, kind }: { page: NavPage; kind: ItemKind }) {
  const { columns, rows, loading, error } = usePoolData(kind)

  if (loading) {
    return (
      <>
        <PageHeader title={page.title} description={page.description} />
        <PoolTableSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <PageHeader title={page.title} description={page.description} />
        <p className="text-sm text-destructive">
          Couldn't load {page.title.toLowerCase()}: {error.message}
        </p>
      </>
    )
  }

  return (
    <>
      <PageHeader title={page.title} description={page.description} />
      <PoolPanel
        kind={kind}
        label={page.title}
        columns={columns}
        rows={rows}
        formKind={kind}
      />
    </>
  )
}
