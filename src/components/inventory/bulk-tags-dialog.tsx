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
import { TagInput } from "@/components/inventory/tag-input"
import { useInventoryStore } from "@/lib/inventory-store"
import { updateItem, type DbInventoryItem } from "@/lib/inventory"

/**
 * Batch "Add tags": applies a set of tags to every selected row, unioned
 * onto whatever tags each row already carries — never removes anything,
 * never duplicates.
 */
export function BulkTagsDialog({
  items,
  open,
  onClose,
  onApplied,
}: {
  items: DbInventoryItem[]
  open: boolean
  onClose: () => void
  /** Fired once, after a successful Confirm — lets the caller clear its own selection. */
  onApplied?: () => void
}) {
  const store = useInventoryStore()
  const [tagsToAdd, setTagsToAdd] = React.useState<string[]>([])
  const [saving, setSaving] = React.useState(false)

  function reset() {
    setTagsToAdd([])
    setSaving(false)
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      await Promise.all(
        items.map((item) => {
          const union = new Set([...item.tags, ...tagsToAdd])
          if (union.size === item.tags.length) return undefined
          return updateItem(store, item.id, {
            title: item.title,
            tags: [...union],
          })
        })
      )
      reset()
      onApplied?.()
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
          <DialogTitle>Add tags</DialogTitle>
          <DialogDescription>
            Choose which tags to add to {itemLabel}.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <TagInput value={tagsToAdd} onValueChange={setTagsToAdd} />
        </DialogBody>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {tagsToAdd.length === 0
              ? "Nothing selected"
              : `${tagsToAdd.length} tag${tagsToAdd.length === 1 ? "" : "s"}`}
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
              disabled={tagsToAdd.length === 0 || saving}
              onClick={handleConfirm}
            >
              {saving
                ? "Adding…"
                : `Add to ${items.length} ${items.length === 1 ? "entry" : "entries"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
