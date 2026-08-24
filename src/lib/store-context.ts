import * as React from "react"

/**
 * Shared by `inventory-store.tsx`, `persona-store.tsx`, and
 * `application-store.tsx` — the three pieces of their scaffold that are
 * byte-identical across all three with no store-specific behavior. The
 * fetch-effect body (each store has a different root/dependent/independent
 * query graph), the per-field `useState` slots (individual setters are
 * called directly by mutators elsewhere — see `inventory.ts`, `persona.ts`,
 * `application.ts`), and the `useMemo` value construction stay in each file;
 * only this is genuinely identical.
 */

export function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught))
}

/** The `refetch()`-forces-a-reload pattern each store's load effect keys off. */
export function useRefetchVersion() {
  const [version, setVersion] = React.useState(0)
  const refetch = React.useCallback(() => setVersion((v) => v + 1), [])
  return { version, refetch }
}

/** A store's `useXStore()` accessor: read the context, throw if outside its Provider. */
export function useStoreContext<T>(
  context: React.Context<T | null>,
  missingProviderMessage: string
): T {
  const value = React.useContext(context)
  if (!value) {
    throw new Error(missingProviderMessage)
  }
  return value
}

/** Every mutator's first line: get the signed-in user's id or throw. */
export function requireUserId<T extends { userId: string | null }>(store: T): string {
  if (!store.userId) {
    throw new Error("No signed-in user.")
  }
  return store.userId
}
