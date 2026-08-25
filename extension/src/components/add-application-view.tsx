import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context"
import { clearDraft, getDraft, saveDraft } from "@/lib/draft-storage"
import { supabase } from "@/lib/supabase"
// Reused verbatim from the web app, per the plan — no reinventing the Quill
// toolbar or the LinkedIn URL/empty-HTML helpers for the extension.
import { VacancyDetailEditor } from "../../../src/components/applications/vacancy-detail-editor"
import { cleanLinkedInJobUrl } from "../../../src/lib/linkedin-job-url"
import { isEmptyHtml } from "../../../src/lib/quill-html"

const DRAFT_SAVE_DEBOUNCE_MS = 500
const DUPLICATE_CHECK_DEBOUNCE_MS = 500
const SAVED_INDICATOR_MS = 2000

async function currentTabUrl(): Promise<string> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0]?.url ?? ""
}

type SaveState = "idle" | "saving" | "saved"

/**
 * The signed-in popup's main view — a reduced add-application form (Company/
 * Position/Post date/URL/Vacancy detail only, see spec 18's field table).
 * Two behaviors beyond the base field list, added after a grill-me review of
 * the plan: draft autosave (so closing the popup mid-entry doesn't lose
 * typed content) and a non-blocking duplicate-URL warning (a heads-up, not a
 * hard block — re-applying to the same posting is legitimate).
 */
export function AddApplicationView() {
  const { session } = useAuth()

  const [company, setCompany] = React.useState("")
  const [position, setPosition] = React.useState("")
  const [postDate, setPostDate] = React.useState("")
  const [sourceUrl, setSourceUrl] = React.useState("")
  const [vacancyDetail, setVacancyDetail] = React.useState("")

  const [hydrated, setHydrated] = React.useState(false)
  const [draftRestored, setDraftRestored] = React.useState(false)
  const [duplicate, setDuplicate] = React.useState<{ createdAt: string } | null>(null)
  const [saveState, setSaveState] = React.useState<SaveState>("idle")
  const [error, setError] = React.useState<string | null>(null)

  function resetFields(preseedUrl: string) {
    setCompany("")
    setPosition("")
    setPostDate("")
    setSourceUrl(preseedUrl)
    setVacancyDetail("")
    setDraftRestored(false)
  }

  // Initial load: a saved draft (if any) wins over the current tab's URL
  // preseed — a mid-entry draft shouldn't get silently clobbered by
  // whatever tab happens to be active on reopen.
  React.useEffect(() => {
    let cancelled = false

    async function init() {
      const draft = await getDraft()
      if (cancelled) return

      if (draft) {
        setCompany(draft.company)
        setPosition(draft.position)
        setPostDate(draft.postDate)
        setSourceUrl(draft.sourceUrl)
        setVacancyDetail(draft.vacancyDetail)
        setDraftRestored(true)
      } else {
        const tabUrl = await currentTabUrl()
        if (cancelled) return
        setSourceUrl(cleanLinkedInJobUrl(tabUrl))
      }

      if (!cancelled) setHydrated(true)
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  // Draft autosave, debounced on every field change — gated on `hydrated`
  // so the initial load above (restoring a draft, or preseeding the URL)
  // doesn't immediately re-trigger a save of what it just set. Only writes
  // a draft while there's real in-progress content (company/position/detail)
  // — a bare URL preseed with nothing else typed isn't "in progress"; saving
  // that anyway would mean a draft always exists and would permanently
  // block the next popup open's fresh tab-URL preseed.
  React.useEffect(() => {
    if (!hydrated) return

    const hasContent =
      company.trim() !== "" || position.trim() !== "" || !isEmptyHtml(vacancyDetail)

    const timeout = setTimeout(() => {
      if (hasContent) {
        void saveDraft({ company, position, postDate, sourceUrl, vacancyDetail })
      } else {
        void clearDraft()
      }
    }, DRAFT_SAVE_DEBOUNCE_MS)

    return () => clearTimeout(timeout)
  }, [hydrated, company, position, postDate, sourceUrl, vacancyDetail])

  // Duplicate-URL check, debounced, only while the URL field is non-empty.
  // The empty-URL "clear" case is also routed through the setTimeout
  // callback (zero-delay) rather than a synchronous setState in the effect
  // body, per `react-hooks/set-state-in-effect`.
  React.useEffect(() => {
    const trimmed = sourceUrl.trim()
    let cancelled = false

    const timeout = setTimeout(
      async () => {
        if (!trimmed) {
          if (!cancelled) setDuplicate(null)
          return
        }

        const { data } = await supabase
          .from("applications")
          .select("id, created_at")
          .eq("source_url", trimmed)
          .limit(1)
        if (cancelled) return
        setDuplicate(data && data.length > 0 ? { createdAt: data[0].created_at } : null)
      },
      trimmed ? DUPLICATE_CHECK_DEBOUNCE_MS : 0
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [sourceUrl])

  // Auto-dismiss the "Saved" confirmation.
  React.useEffect(() => {
    if (saveState !== "saved") return
    const timeout = setTimeout(() => setSaveState("idle"), SAVED_INDICATOR_MS)
    return () => clearTimeout(timeout)
  }, [saveState])

  const canSubmit = company.trim() !== "" && position.trim() !== ""

  async function handleClearDraft() {
    await clearDraft()
    const tabUrl = await currentTabUrl()
    resetFields(cleanLinkedInJobUrl(tabUrl))
  }

  async function handleSave() {
    const trimmedCompany = company.trim()
    const trimmedPosition = position.trim()
    if (!trimmedCompany || !trimmedPosition || !session) return

    setSaveState("saving")
    setError(null)

    const { error: insertError } = await supabase
      .from("applications")
      .insert({
        user_id: session.user.id,
        title: `${trimmedPosition} at ${trimmedCompany}`,
        company: trimmedCompany,
        position: trimmedPosition,
        deadline: postDate || null,
        source_url: sourceUrl.trim() || null,
        vacancy_detail: isEmptyHtml(vacancyDetail) ? null : vacancyDetail,
        global_status: "draft",
      })
      .select()
      .single()

    if (insertError) {
      // Leave the draft intact on error so nothing is lost.
      setError(insertError.message)
      setSaveState("idle")
      return
    }

    await clearDraft()
    const tabUrl = await currentTabUrl()
    resetFields(cleanLinkedInJobUrl(tabUrl))
    setSaveState("saved")
  }

  return (
    <div className="flex flex-col gap-3">
      {draftRestored && (
        <FieldDescription className="text-primary">Draft restored</FieldDescription>
      )}

      <FieldGroup>
        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel htmlFor="qa-company">
              Company <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="qa-company"
              placeholder="Acme Inc."
              autoFocus
              value={company}
              onChange={(event) => setCompany(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="qa-position">
              Position <span className="text-destructive">*</span>
            </FieldLabel>
            <Input
              id="qa-position"
              placeholder="Senior Engineer"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="qa-post-date">Post date</FieldLabel>
          <Input
            id="qa-post-date"
            type="date"
            value={postDate}
            onChange={(event) => setPostDate(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="qa-url">URL</FieldLabel>
          <Input
            id="qa-url"
            type="url"
            placeholder="Link to the job listing"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            onBlur={() => setSourceUrl((current) => cleanLinkedInJobUrl(current))}
          />
          {duplicate && (
            <FieldDescription>
              Already added on {new Date(duplicate.createdAt).toLocaleDateString()}
            </FieldDescription>
          )}
        </Field>

        <Field>
          <FieldLabel htmlFor="qa-vacancy-detail">Vacancy detail</FieldLabel>
          <VacancyDetailEditor
            id="qa-vacancy-detail"
            value={vacancyDetail}
            onValueChange={setVacancyDetail}
            placeholder="Paste the job description or notes"
          />
        </Field>
      </FieldGroup>

      {error && <FieldError>{error}</FieldError>}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={handleClearDraft}>
          Clear draft
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || saveState === "saving"}
          onClick={handleSave}
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  )
}
