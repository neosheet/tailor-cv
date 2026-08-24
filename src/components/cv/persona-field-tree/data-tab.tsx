import * as React from "react"

import { LINE_HEADING } from "@/components/inventory/columns"
import { PersonaEditorDialog } from "@/components/persona/persona-editor-dialog"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { KIND_ICON, LeafRow, ParentRow } from "@/components/cv/persona-field-tree/shared"
import { setItemHidden } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { linesOf } from "@/lib/inventory"
import { useInventoryStore } from "@/lib/inventory-store"
import {
  groupItemsByCategory,
  isItemHidden,
  LINE_ORDER,
  orderedSectionKinds,
  selectedEntriesOf,
  selectedLineIdsOf,
  setLineSelected,
  titleFor,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication, DbInventoryItem, ItemKind } from "@/mocks/types"

/** One selected entry (a job, a skill, a social link, ...) with its bullets, if any. */
function ItemRow({
  application,
  personaId,
  kind,
  item,
}: {
  application: DbApplication
  personaId: string
  kind: ItemKind
  item: DbInventoryItem
}) {
  const personaStore = usePersonaStore()
  const applicationStore = useApplicationStore()
  const inventoryStore = useInventoryStore()
  const [open, setOpen] = React.useState(false)

  const fieldVisibility = application.cvPersonaSettings.fieldVisibility ?? {}
  const hidden = isItemHidden(fieldVisibility, kind, item.id)
  const chosenLineIds = selectedLineIdsOf(personaStore, personaId, item.id)

  const lineGroups = LINE_ORDER.flatMap((lineKind) => {
    const lines = linesOf(inventoryStore, item.id, lineKind)
    return lines.length > 0 ? [{ lineKind, lines }] : []
  })

  const label = item.subtitle ? `${item.title} — ${item.subtitle}` : item.title

  const row = (
    <ParentRow
      icon={KIND_ICON[kind]}
      label={label}
      hidden={hidden}
      open={open}
      expandable={lineGroups.length > 0}
      onToggleHidden={() =>
        void setItemHidden(applicationStore, application.id, kind, item.id, !hidden)
      }
    />
  )

  if (lineGroups.length === 0) {
    return row
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {row}
      <CollapsibleContent>
        {lineGroups.map(({ lineKind, lines }) => (
          <div key={lineKind}>
            <p className="pt-1 pr-1 pb-1 pl-14 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {LINE_HEADING[lineKind]}
            </p>
            {lines.map((line) => (
              <LeafRow
                key={line.id}
                label={line.content}
                hidden={!chosenLineIds.has(line.id)}
                onToggle={() =>
                  void setLineSelected(
                    personaStore,
                    personaId,
                    item.id,
                    line.id,
                    !chosenLineIds.has(line.id)
                  )
                }
                indent="pl-14"
              />
            ))}
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

/** A run of `ItemRow`s for one kind (or one skill category within the Skills kind). */
function ItemRowList({
  application,
  personaId,
  kind,
  items,
}: {
  application: DbApplication
  personaId: string
  kind: ItemKind
  items: DbInventoryItem[]
}) {
  return (
    <div className="flex flex-col">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          application={application}
          personaId={personaId}
          kind={kind}
          item={item}
        />
      ))}
    </div>
  )
}

export function DataTab({ application }: { application: DbApplication }) {
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const [editOpen, setEditOpen] = React.useState(false)
  if (!application.cvPersonaId) {
    return null
  }
  const personaId = application.cvPersonaId
  const dataKinds: ItemKind[] = [
    "social",
    ...orderedSectionKinds(personaStore, personaId),
  ]

  const groups = dataKinds.flatMap((kind) => {
    const items = selectedEntriesOf(personaStore, inventoryStore, personaId, kind)
    return items.length > 0 ? [{ kind, items }] : []
  })

  return (
    <div className="flex flex-col gap-3">
      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-2 px-2 py-4">
          <p className="text-sm text-muted-foreground">No entries selected yet.</p>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit persona
          </Button>
        </div>
      ) : (
        <>
          <div className="flex justify-end px-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              Edit persona
            </Button>
          </div>
          {groups.map(({ kind, items }) => (
            <div key={kind}>
              <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {titleFor(kind)}
              </p>
              {kind === "skill" ? (
                <div className="flex flex-col gap-2">
                  {groupItemsByCategory(inventoryStore, items).map((group) => (
                    <div key={group.category}>
                      <p className="px-2 pb-0.5 text-[10px] font-medium tracking-wide text-muted-foreground/80 uppercase">
                        {group.category}
                      </p>
                      <ItemRowList
                        application={application}
                        personaId={personaId}
                        kind={kind}
                        items={group.items}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <ItemRowList
                  application={application}
                  personaId={personaId}
                  kind={kind}
                  items={items}
                />
              )}
            </div>
          ))}
        </>
      )}
      <PersonaEditorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        personaId={personaId}
      />
    </div>
  )
}
