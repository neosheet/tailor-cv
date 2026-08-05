import * as React from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
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
import { allCvs, cvsUsingItem } from "@/mocks/cv"
import type { DbInventoryItem } from "@/mocks"

/**
 * Pick which CVs an entry should be added to. Multi-select.
 *
 * CVs that already include the entry are shown checked and disabled — the
 * question is which CVs to *add* it to, and offering to add it somewhere it
 * already exists is a way to produce a confusing no-op.
 */
export function AddToCvDialog({
  item,
  open,
  onClose,
}: {
  item: DbInventoryItem
  open: boolean
  onClose: () => void
}) {
  const cvs = allCvs()
  const alreadyIn = React.useMemo(
    () => new Set(cvsUsingItem(item.id).map((usage) => usage.cv.id)),
    [item.id]
  )

  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())

  function toggle(cvId: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      if (checked) {
        next.add(cvId)
      } else {
        next.delete(cvId)
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
          <DialogTitle>Add to CV</DialogTitle>
          <DialogDescription>
            Choose which CVs should include “{item.title}”.
          </DialogDescription>
        </DialogHeader>

        <ItemGroup className="gap-1">
          {cvs.map((cv) => {
            const existing = alreadyIn.has(cv.id)

            return (
              <Item key={cv.id} variant="outline">
                <Checkbox
                  checked={existing || selected.has(cv.id)}
                  disabled={existing}
                  onCheckedChange={(checked) => toggle(cv.id, checked)}
                  aria-label={`Add to ${cv.name}`}
                />
                <ItemContent>
                  <ItemTitle>{cv.name}</ItemTitle>
                  {cv.note ? (
                    <ItemDescription>{cv.note}</ItemDescription>
                  ) : null}
                </ItemContent>
                {existing ? (
                  <Badge variant="secondary">Already added</Badge>
                ) : null}
              </Item>
            )
          })}
        </ItemGroup>

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
              Add to {selected.size || "…"} CV{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
