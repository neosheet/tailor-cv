import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { POOL_COLUMNS } from "@/components/inventory/pool-columns"
import { PoolPanel } from "@/components/inventory/pool-panel"
import { itemsOfKind, type BasicsKind } from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"
import { inventoryPages } from "@/lib/navigation"

const POOLS: {
  kind: BasicsKind
  label: string
  description: string
}[] = [
  {
    kind: "name",
    label: "Name",
    description:
      "What you're called at the top of the CV. A CV uses one of these.",
  },
  {
    kind: "headline",
    label: "Headline",
    description:
      "The one-line title under your name. A CV uses one of these — the pool you'll switch between most.",
  },
  {
    kind: "summary",
    label: "Summary",
    description:
      "The opening paragraph. A CV uses one of these; the label is yours and never exports.",
  },
  {
    kind: "contact",
    label: "Contact",
    description:
      "Email, phone, and personal site, kept together as a set. A CV uses one of these.",
  },
  {
    kind: "location",
    label: "Location",
    description:
      "Where you are — or where you're willing to be. A CV uses one of these.",
  },
  {
    kind: "social",
    label: "Social",
    description: "Profile links. Unlike the others, a CV can show several.",
  },
]

export function BasicsPage() {
  const store = useInventoryStore()

  return (
    <>
      <PageHeader
        title={inventoryPages.basics.title}
        description={inventoryPages.basics.description}
      />

      <Tabs defaultValue="name" className="gap-4">
        <TabsList variant="line">
          {POOLS.map((pool) => (
            <TabsTrigger key={pool.kind} value={pool.kind}>
              {pool.label}
              <span className="text-muted-foreground tabular-nums">
                {itemsOfKind(store, pool.kind).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {POOLS.map((pool) => (
          <TabsContent
            key={pool.kind}
            value={pool.kind}
            className="flex flex-col gap-3"
          >
            <PoolPanel
              kind={pool.kind}
              label={pool.label}
              description={pool.description}
              columns={POOL_COLUMNS[pool.kind]}
              rows={itemsOfKind(store, pool.kind)}
              formKind={pool.kind}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}
