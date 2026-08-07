import { Badge } from "@/components/ui/badge"
import { NavCard } from "@/components/layout/nav-card"
import { PageHeader } from "@/components/layout/page-header"
import { inventoryGroups, sections } from "@/lib/navigation"

/**
 * The Inventory landing view — a completeness overview across every pool.
 * Counts are hardcoded to zero until the data model lands (spec 02).
 */
export function InventoryIndexPage() {
  return (
    <>
      <PageHeader
        title={sections.inventory.title}
        description={sections.inventory.description}
      />

      {inventoryGroups.map((group) => (
        <section key={group.label} className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">
            {group.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.pages.map((page) => (
              <NavCard
                key={page.path}
                page={page}
                // Utility pages aren't pools, so a completeness badge would mislead.
                action={
                  group.label === "Utility" ? undefined : (
                    <Badge variant="outline">Empty</Badge>
                  )
                }
              />
            ))}
          </div>
        </section>
      ))}
    </>
  )
}
