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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useInventoryStore } from "@/lib/inventory-store"
import { updateItem, type DbInventoryItem } from "@/lib/inventory"

/** Sentinel for the Category select's "no category" option — mirrors `item-dialog.tsx`. */
const NO_CATEGORY = "none"

/**
 * Batch "Add to Category": sets the same `categoryId` on every selected
 * skill, overwriting whatever category each row already carried. Skills
 * only — `categoryId` isn't a field on any other pool.
 */
export function BulkCategoryDialog({
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
  const [categoryId, setCategoryId] = React.useState<string | null>(null)
  const [saving, setSaving] = React.useState(false)

  function reset() {
    setCategoryId(null)
    setSaving(false)
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      await Promise.all(
        items.map((item) =>
          updateItem(store, item.id, { title: item.title, categoryId })
        )
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

  const categoryOptions = [
    { value: NO_CATEGORY, label: "No category" },
    ...store.skillCategories.map((category) => ({
      value: category.id,
      label: category.name,
    })),
  ]

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
          <DialogTitle>Add to category</DialogTitle>
          <DialogDescription>
            Choose a category to set on {itemLabel}.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <Select
            items={categoryOptions}
            value={categoryId ?? NO_CATEGORY}
            onValueChange={(next) =>
              setCategoryId(next === NO_CATEGORY ? null : (next as string))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category…" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </DialogBody>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={saving} onClick={handleConfirm}>
              {saving
                ? "Applying…"
                : `Apply to ${items.length} ${items.length === 1 ? "entry" : "entries"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
