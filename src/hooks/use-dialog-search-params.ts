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
 *
 * `prefix` namespaces the managed keys (`dialog` → `{prefix}Dialog`, and any
 * extra/companion key the same way) — needed wherever one of these
 * dialog-driven components is mounted inside another one's popup (e.g. the
 * Inventory pool picker inside a Persona page), so the inner "add entry"
 * dialog doesn't fight the outer popup over the same `dialog=` param.
 */
export function useDialogSearchParams(prefix?: string): {
  dialog: string | null
  get: (param: string) => string | null
  open: (dialog: string, extra?: Record<string, string>) => void
  close: (extraKeys?: string[]) => void
} {
  const [searchParams, setSearchParams] = useSearchParams()

  const key = React.useCallback(
    (name: string) =>
      prefix ? `${prefix}${name[0].toUpperCase()}${name.slice(1)}` : name,
    [prefix]
  )

  const open = React.useCallback(
    (dialog: string, extra?: Record<string, string>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set(key("dialog"), dialog)
        for (const [name, value] of Object.entries(extra ?? {})) {
          next.set(key(name), value)
        }
        return next
      })
    },
    [setSearchParams, key]
  )

  const close = React.useCallback(
    (extraKeys?: string[]) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key("dialog"))
        for (const name of extraKeys ?? []) {
          next.delete(key(name))
        }
        return next
      })
    },
    [setSearchParams, key]
  )

  const get = React.useCallback(
    (param: string) => searchParams.get(key(param)),
    [searchParams, key]
  )

  return {
    dialog: searchParams.get(key("dialog")),
    get,
    open,
    close,
  }
}
