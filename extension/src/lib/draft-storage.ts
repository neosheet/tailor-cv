// In-progress add-application form state, persisted to `chrome.storage.local`
// under its own key (distinct from the Supabase session keys the auth
// storage adapter owns) so a mid-entry form survives the popup closing.
// `chrome.storage.local` stores structured values directly — no JSON
// stringify/parse needed, unlike the session adapter which follows
// supabase-js's string-only `storage` contract.

const DRAFT_KEY = "draft-application"

export type ApplicationDraft = {
  company: string
  position: string
  postDate: string
  sourceUrl: string
  vacancyDetail: string
}

export async function getDraft(): Promise<ApplicationDraft | null> {
  const result = await chrome.storage.local.get(DRAFT_KEY)
  const draft = result[DRAFT_KEY]
  return draft ? (draft as ApplicationDraft) : null
}

export async function saveDraft(draft: ApplicationDraft): Promise<void> {
  await chrome.storage.local.set({ [DRAFT_KEY]: draft })
}

export async function clearDraft(): Promise<void> {
  await chrome.storage.local.remove(DRAFT_KEY)
}
