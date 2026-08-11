import { useSearchParams } from "react-router"
import * as React from "react"

/**
 * Every dialog/drawer in the app was independently `useState`, each
 * reimplementing the same open/close-by-URL-param shape (a `dialog` kind plus
 * a handful of companion params like an entity id). Sharing one hook keeps
 * that contract identical everywhere: opening always pushes a history entry
 * (so Back closes the dialog), closing always removes exactly the keys that
 * were set and never leaves an orphaned `dialog=` behind, and unrelated
 * params (like a page's `tab`) are always left untouched.
 */
export function useDialogSearchParams(): {
  dialog: string | null
  get: (param: string) => string | null
  open: (dialog: string, extra?: Record<string, string>) => void
  close: (extraKeys?: string[]) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const open = React.useCallback(
    (dialog: string, extra?: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set("dialog", dialog)
        for (const [key, value] of Object.entries(extra ?? {})) {
          next.set(key, value)
        }
        return next
      })
    },
    [setSearchParams]
  )

  const close = React.useCallback(
    (extraKeys?: string[]) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete("dialog")
        for (const key of extraKeys ?? []) {
          next.delete(key)
        }
        return next
      })
    },
    [setSearchParams]
  )

  const get = React.useCallback(
    (param: string) => searchParams.get(param),
    [searchParams]
  )

  return {
    dialog: searchParams.get("dialog"),
    get,
    open,
    close,
  }
}
