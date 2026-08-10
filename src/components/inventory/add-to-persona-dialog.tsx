import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { useInventoryStore } from "@/lib/inventory-store"
import {
  allPersonas,
  itemIdsForKind,
  PICK_ONE_KINDS,
  setPersonaSectionItems,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbInventoryItem, ItemKind } from "@/mocks"

/**
 * Batch "Add to Persona": pick which Personas a set of Inventory rows (all
 * the same `kind`, e.g. a batch of selected Skills) should be added to.
 * Multi-select Personas.
 *
 * For `PICK_ONE_KINDS` (Basics single-value kinds like Headline), a Persona
 * can hold at most one entry — only the last-selected of `items` (the order
 * rows were checked in, upstream) is ever a candidate. For every other kind,
 * a target Persona that already has some of the batch keeps those and only
 * gains the ones it's missing — never a duplicate, never a removal.
 */
export function AddToPersonaDialog({
  kind,
  items,
  open,
  onClose,
  onAdded,
}: {
  kind: ItemKind
  items: DbInventoryItem[]
  open: boolean
  onClose: () => void
  /** Fired once, after a successful Confirm — lets the caller clear its own selection. */
  onAdded?: () => void
}) {
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const personas = allPersonas(personaStore)
  const pickOne = PICK_ONE_KINDS.includes(kind)

  const candidateIds = React.useMemo(
    () => (pickOne ? items.slice(-1).map((item) => item.id) : items.map((item) => item.id)),
    [items, pickOne]
  )

  const alreadyIn = React.useMemo(
    () =>
      new Set(
        personas
          .filter((persona) => {
            const previous = itemIdsForKind(
              personaStore,
              inventoryStore,
              persona.id,
              kind
            )
            return candidateIds.every((id) => previous.includes(id))
          })
          .map((persona) => persona.id)
      ),
    [personas, personaStore, inventoryStore, kind, candidateIds]
  )

  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())
  const [saving, setSaving] = React.useState(false)

  function toggle(personaId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(personaId)
      } else {
        next.delete(personaId)
      }
      return next
    })
  }

  function reset() {
    setSelected(new Set())
    setSaving(false)
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      for (const personaId of selected) {
        const previous = itemIdsForKind(
          personaStore,
          inventoryStore,
          personaId,
          kind
        )
        const toAdd = candidateIds.filter((id) => !previous.includes(id))
        if (toAdd.length === 0) continue

        const nextIds = pickOne ? toAdd : [...previous, ...toAdd]
        await setPersonaSectionItems(
          personaStore,
          inventoryStore,
          personaId,
          kind,
          nextIds,
          previous
        )
      }
      reset()
      onAdded?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const itemLabel =
    items.length === 1 ? `“${items[0].title}”` : `${items.length} entries`

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Persona</DialogTitle>
          <DialogDescription>
            Choose which Personas should include {itemLabel}
            {pickOne && items.length > 1
              ? " — only the last one you selected will be added."
              : "."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <ItemGroup className="gap-1">
            {personas.map((persona) => {
              const existing = alreadyIn.has(persona.id)

              return (
                <Item key={persona.id} variant="outline">
                  <Checkbox
                    checked={existing || selected.has(persona.id)}
                    disabled={existing}
                    onCheckedChange={(checked) => toggle(persona.id, checked)}
                    aria-label={`Add to ${persona.name}`}
                  />
                  <ItemContent>
                    <ItemTitle>{persona.name}</ItemTitle>
                    {persona.note ? (
                      <ItemDescription>{persona.note}</ItemDescription>
                    ) : null}
                  </ItemContent>
                  {existing ? (
                    <Badge variant="secondary">Already added</Badge>
                  ) : null}
                </Item>
              )
            })}
          </ItemGroup>
        </DialogBody>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.size === 0 ? "Nothing selected" : `${selected.size} selected`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0 || saving}
              onClick={handleConfirm}
            >
              {saving
                ? "Adding…"
                : `Add to ${selected.size || "…"} Persona${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
