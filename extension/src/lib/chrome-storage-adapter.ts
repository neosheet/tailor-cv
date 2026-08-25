// Storage adapter for Supabase's `auth.storage` option, backed by
// `chrome.storage.local` instead of `localStorage` (which isn't reliably
// available/persistent for a popup that fully unmounts on close). Supabase
// accepts Promise-returning `getItem`/`setItem`/`removeItem` implementations
// — this is the same shape its own React Native `AsyncStorage` adapter uses.

export const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const result = await chrome.storage.local.get(key)
    return key in result ? (result[key] as string) : null
  },

  async setItem(key: string, value: string): Promise<void> {
    await chrome.storage.local.set({ [key]: value })
  },

  async removeItem(key: string): Promise<void> {
    await chrome.storage.local.remove(key)
  },
}
