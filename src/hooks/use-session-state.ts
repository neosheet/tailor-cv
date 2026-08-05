import * as React from "react"

/** Namespaced so the app's keys can't collide with anything else on the origin. */
const PREFIX = "tailor-cv:"

function read<T>(key: string, fallback: T): T {
  try {
    const stored = sessionStorage.getItem(PREFIX + key)
    return stored === null ? fallback : (JSON.parse(stored) as T)
  } catch {
    // Private-mode storage throws, and a hand-edited key can fail to parse.
    // Neither is worth breaking a page over — fall back to the default.
    return fallback
  }
}

/**
 * State that survives navigating away and coming back.
 *
 * `sessionStorage`, not React state lifted to a provider: a filter you set on
 * Work should still be there when you return from CVs, and should still be
 * there after a reload — but it should not follow you into next week, which is
 * what `localStorage` would do.
 *
 * The key is assumed constant for the life of the component. Every caller keys
 * by something fixed (a pool's `kind`), so a changing key would mean a component
 * being reused for a different pool, which no call site does.
 */
export function useSessionState<T>(
  key: string,
  initial: T
): [T, (value: T) => void] {
  const [value, setValue] = React.useState<T>(() => read(key, initial))

  const store = React.useCallback(
    (next: T) => {
      setValue(next)

      try {
        sessionStorage.setItem(PREFIX + key, JSON.stringify(next))
      } catch {
        // Storage full or unavailable. The in-memory state still updated, so the
        // page works — it just won't be there after a reload.
      }
    },
    [key]
  )

  return [value, store]
}
