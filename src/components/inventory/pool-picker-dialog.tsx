import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { PoolPanel } from "@/components/inventory/pool-panel"
import { usePoolData } from "@/components/inventory/use-pool-data"
import type { ItemKind } from "@/lib/inventory"

/**
 * Large popup around the real Inventory table for one pool, repurposed as a
 * picker — pick which entries populate a Persona section. Reuses `PoolPanel`
 * in `mode="pick"` rather than a parallel table, per spec 06/plan 09.
 */
export function PoolPickerDialog({
  kind,
  open,
  onOpenChange,
  title,
  description,
  singleSelect = false,
  initialSelected,
  onConfirm,
}: {
  kind: ItemKind
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  singleSelect?: boolean
  /** This section's currently-selected item ids. */
  initialSelected: string[]
  onConfirm: (itemIds: string[]) => void | Promise<void>
}) {
  const { columns, rows, loading, error } = usePoolData(kind)
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(new Set())
  // What was already saved when the dialog opened — used only to sort
  // previously-picked rows to the top. Frozen for the whole open session, so
  // checking/unchecking boxes never reshuffles the list; it only updates the
  // next time the dialog opens, after a successful confirm.
  const [pinnedIds, setPinnedIds] = React.useState<ReadonlySet<string>>(
    new Set()
  )
  const [saving, setSaving] = React.useState(false)

  // Seeded only on the open transition, adjusted during render rather than
  // in an effect (React's own recommended pattern for "derive state from a
  // changing prop") — reacting to `initialSelected` directly would re-seed
  // (and discard in-progress picks) on every render while the dialog stays
  // open, since the caller may pass a fresh array identity each render.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setSelected(new Set(initialSelected))
      setPinnedIds(new Set(initialSelected))
    }
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      await onConfirm([...selected])
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3 pt-1">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : error ? (
            <p className="text-sm text-destructive">
              Couldn't load entries: {error.message}
            </p>
          ) : (
            <PoolPanel
              kind={kind}
              label={title}
              columns={columns}
              rows={rows}
              formKind={kind}
              mode="pick"
              selectionMode={singleSelect ? "single" : "multiple"}
              selected={selected}
              onSelectedChange={setSelected}
              pinnedIds={pinnedIds}
            />
          )}
        </DialogBody>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {selected.size === 0 ? "Nothing selected" : `${selected.size} selected`}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={handleConfirm}>
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
