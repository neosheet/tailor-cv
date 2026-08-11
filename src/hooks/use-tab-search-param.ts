import { useSearchParams } from "react-router"
import * as React from "react"

/**
 * Tabs backed by a URL query param instead of local/uncontrolled state.
 *
 * A plain `useState` (or an uncontrolled `Tabs defaultValue`) loses the active
 * tab on reload and can't be deep-linked. But writing `defaultValue` straight
 * into the URL on every mount would push a spurious history entry before the
 * user has done anything — so the fill-in uses `replace` once, in an effect,
 * and only while the param is genuinely absent; every user-driven tab switch
 * after that pushes normally, so Back steps through tab history.
 */
export function useTabSearchParam(
  param: string,
  defaultValue: string
): [string, (value: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const current = searchParams.get(param)
  const value = current ?? defaultValue

  React.useEffect(() => {
    if (current === null) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set(param, defaultValue)
          return next
        },
        { replace: true }
      )
    }
  }, [current, param, defaultValue, setSearchParams])

  const setValue = React.useCallback(
    (next: string) => {
      setSearchParams((prev) => {
        const nextParams = new URLSearchParams(prev)
        nextParams.set(param, next)
        return nextParams
      })
    },
    [param, setSearchParams]
  )

  return [value, setValue]
}
