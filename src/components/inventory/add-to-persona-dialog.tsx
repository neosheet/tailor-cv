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
import { allPersonas, personasUsingItem } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbInventoryItem } from "@/mocks"

/**
 * Pick which Personas an entry should be added to. Multi-select.
 *
 * Personas that already include the entry are shown checked and disabled —
 * the question is which Personas to *add* it to, and offering to add it
 * somewhere it already exists is a way to produce a confusing no-op.
 */
export function AddToPersonaDialog({
  item,
  open,
  onClose,
}: {
  item: DbInventoryItem
  open: boolean
  onClose: () => void
}) {
  const store = usePersonaStore()
  const personas = allPersonas(store)
  const alreadyIn = React.useMemo(
    () =>
      new Set(
        personasUsingItem(store, item.id).map((usage) => usage.persona.id)
      ),
    [store, item.id]
  )

  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())

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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelected(new Set())
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Persona</DialogTitle>
          <DialogDescription>
            Choose which Personas should include “{item.title}”.
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
            {selected.size === 0
              ? "Nothing selected"
              : `${selected.size} selected`}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" disabled>
              Add to {selected.size || "…"} Persona
              {selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
