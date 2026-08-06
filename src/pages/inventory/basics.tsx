import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/layout/page-header"
import { TAGS_NOTE } from "@/components/inventory/columns"
import { PoolPanel } from "@/components/inventory/pool-panel"
import { ValueCell, type PoolColumn } from "@/components/inventory/pool-table"
import {
  contactDetails,
  itemsOfKind,
  locationDetails,
  type BasicsKind,
} from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"
import { inventoryPages } from "@/lib/navigation"

const POOLS: {
  kind: BasicsKind
  label: string
  description: string
  columns: PoolColumn[]
}[] = [
  {
    kind: "name",
    label: "Name",
    description:
      "What you're called at the top of the CV. A CV uses one of these.",
    columns: [{ header: "Name", cell: (item) => item.title }, ...TAGS_NOTE],
  },
  {
    kind: "headline",
    label: "Headline",
    description:
      "The one-line title under your name. A CV uses one of these — the pool you'll switch between most.",
    columns: [{ header: "Headline", cell: (item) => item.title }, ...TAGS_NOTE],
  },
  {
    kind: "summary",
    label: "Summary",
    description:
      "The opening paragraph. A CV uses one of these; the label is yours and never exports.",
    columns: [
      { header: "Label", cell: (item) => item.title },
      {
        header: "Summary",
        cell: (item) => <ValueCell value={item.summary} />,
      },
      ...TAGS_NOTE,
    ],
  },
  {
    kind: "contact",
    label: "Contact",
    description:
      "Email, phone, and personal site, kept together as a set. A CV uses one of these.",
    columns: [
      { header: "Label", cell: (item) => item.title },
      {
        header: "Email",
        cell: (item) => <ValueCell value={contactDetails(item).email} />,
      },
      {
        header: "Phone",
        cell: (item) => <ValueCell value={contactDetails(item).phone} />,
      },
      {
        header: "Website",
        cell: (item) => (
          <ValueCell
            value={
              contactDetails(item).url?.replace(/^https?:\/\//, "") ?? null
            }
          />
        ),
      },
      ...TAGS_NOTE,
    ],
  },
  {
    kind: "location",
    label: "Location",
    description:
      "Where you are — or where you're willing to be. A CV uses one of these.",
    columns: [
      { header: "City", cell: (item) => locationDetails(item).city },
      {
        header: "Region",
        cell: (item) => <ValueCell value={locationDetails(item).region} />,
      },
      {
        header: "Postal",
        cell: (item) => <ValueCell value={locationDetails(item).postalCode} />,
      },
      {
        header: "Country",
        cell: (item) => <ValueCell value={locationDetails(item).countryCode} />,
      },
      ...TAGS_NOTE,
    ],
  },
  {
    kind: "social",
    label: "Social",
    description: "Profile links. Unlike the others, a CV can show several.",
    columns: [
      { header: "Network", cell: (item) => item.title },
      {
        header: "Username",
        cell: (item) => <ValueCell value={item.subtitle} />,
      },
      {
        header: "URL",
        cell: (item) => (
          <ValueCell value={item.url?.replace(/^https?:\/\//, "") ?? null} />
        ),
      },
      ...TAGS_NOTE,
    ],
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
              columns={pool.columns}
              rows={itemsOfKind(store, pool.kind)}
              formKind={pool.kind}
            />
          </TabsContent>
        ))}
      </Tabs>
    </>
  )
}
