# 18 — Inline persona editing in the Applications CV tab

Spec: [docs/specs/16-inline-persona-editing-in-cv-tab.md](../specs/16-inline-persona-editing-in-cv-tab.md)

## Phase 0 — Documentation discovery (existing code patterns)

No external docs involved — this is entirely internal-pattern reuse. Findings
below are consolidated from direct reads of the cited files (line numbers as
of this plan's authoring; re-check if the file has moved on since).

**Allowed APIs / patterns to copy from:**

- `createPersona(store: PersonaStore, fields: { name; note?; tags? }): Promise<DbPersona>`
  — `src/lib/persona.ts:687-710`. Writes to Supabase and mirrors into
  `store.setPersonas` — the returned `DbPersona` is immediately usable (no
  `refetch()` needed).
- `findPersona(data: PersonaData, personaId: string): DbPersona | undefined`
  — `src/lib/persona.ts:56-61`.
- `usePersonaStore()` — `src/lib/persona-store.tsx:269-274` (or nearby;
  re-grep if line drifted) — context hook, callable from anywhere in the
  tree, no prop drilling.
- `useDialogSearchParams(prefix?: string)` — `src/hooks/use-dialog-search-params.ts`.
  Returns `{ dialog, get, open, close }`. Passing a `prefix` namespaces the
  managed URL keys (`dialog` → `{prefix}Dialog`, extras similarly) —
  **exactly the mechanism this plan needs** to nest a persona editor's own
  dialog state inside a page that already manages its own `dialog` param
  (`application-detail-view.tsx` has two unprefixed
  `useDialogSearchParams()` calls at lines 414 and 494 — a third unprefixed
  one would collide).
- `PersonaFormDialog` — `src/components/persona/persona-form-dialog.tsx`.
  Exports `PersonaFormFields = { name, note, tags }`. Currently a full
  `Dialog` shell around `Field`/`Input`/`NoteInput`/`TagInput` — Phase 2
  needs just its **field markup** (lines 84-99: the `DialogBody` contents),
  not the dialog chrome, since the create-mode step lives inside another
  dialog already. Don't import `PersonaFormDialog` itself for this — copy
  the three field components' usage pattern instead
  (`Input`/`NoteInput`/`TagInput`, same props).
- Large-dialog precedent: `src/components/cv/template-view-dialog.tsx:33`
  uses `<DialogContent className="max-h-[92vh] sm:max-w-3xl">` for a
  content-heavy preview dialog with internal scrolling — copy this sizing
  pattern (spec calls for `sm:max-w-5xl` given `PersonaEditorPanel` is wider
  than a template preview; add `overflow-y-auto`).
- `DeletePersonaDialog` — `src/components/persona/delete-persona-dialog.tsx:20-`
  — already takes `applicationCount` and shows a warning
  (`"{N} application(s) using it for its CV will lose that attachment"`).
  No changes needed; reused as-is inside `PersonaEditorPanel`.
- `SelectSeparator` — exported from `src/components/ui/select.tsx:189-197`
  alongside `SelectItem`/`SelectGroup` — use it to visually separate the
  "+ Create new persona…" entry from real persona options in
  `application-cv-setup.tsx`.
- Existing dialog-open-state convention in `application-detail-view.tsx`:
  `ImportCvSettingsDialog` uses a plain `React.useState(false)` (line 425),
  not URL-synced — cite as the pattern for `PersonaEditorDialog`'s open
  state at both call sites (`ApplicationCvSetup` and `DataTab`): a popup
  nested this deep doesn't need to survive a refresh.

**Anti-patterns to avoid:**

- Don't give `PersonaEditorDialog`'s own open/close state a
  `useDialogSearchParams` — only the *panel's internal* pool-picker/edit
  /duplicate/delete/skills-check state uses that hook (with
  `dialogParamPrefix="persona"`). Two nested URL-synced layers is more than
  needed here; a `useState` boolean at the call site is enough and matches
  `ImportCvSettingsDialog`.
- Don't invent a `PersonaStore` method for creating — `createPersona` is a
  free function taking the store, not a store method (`store.createPersona`
  does not exist).
- Don't reuse the exact `dialog` param key unprefixed anywhere near
  `application-detail-view.tsx` — always pass `"persona"` as
  `dialogParamPrefix` for the embedded panel.

---

## Phase 1 — Extract `PersonaEditorPanel` from `PersonaDetailPage`

**What:** Move the content body of `PersonaDetailPage`
(`src/pages/persona-detail.tsx`) into a new component that takes `personaId`
directly instead of reading `useParams()`, and an optional
`dialogParamPrefix` forwarded to `useDialogSearchParams()`. This is a pure
refactor — no behavior change, no new UI yet.

1. Create `src/components/persona/persona-editor-panel.tsx`:
   - Copy `PersonaDetailPage`'s body from `src/pages/persona-detail.tsx:132`
     (`const document = buildResumeDocument(...)`) through the end of the
     returned JSX (currently ending around line 453, the `</DeletePersonaDialog>`
     closing tag before `PersonaDetailPage`'s closing brace) — i.e. everything
     *except* the "Back to Personas" `Button`/`Link` (lines 164-173) and the
     not-found `Empty` guard (lines 107-130).
   - Also copy the helper components used only by this content —
     `PickButton`, `BasicsCard`, `SectionCard`, `EntryView` (lines 457-600) —
     into the same file (they're not used elsewhere; confirm with
     `grep -rn "BasicsCard\|SectionCard\b" src` before moving, to be sure).
   - Signature:
     ```ts
     export function PersonaEditorPanel({
       personaId,
       dialogParamPrefix,
     }: {
       personaId: string
       dialogParamPrefix?: string
     })
     ```
   - Replace `useDialogSearchParams()` with `useDialogSearchParams(dialogParamPrefix)`.
   - Replace every `persona.id` / `id` (from `useParams`) reference with the
     `personaId` prop; do the `findPersona(personaStore, personaId)` lookup
     inside the panel itself.
   - Not-found fallback inside the panel (defensive — callers should
     normally guarantee a valid id, but `DataTab`'s "Edit persona" trigger
     reads `application.cvPersonaId` which is a stale FK in theory): a plain
     `<p className="text-sm text-muted-foreground">Persona not found.</p>`,
     no `Empty`/back-link chrome (that's page-level, not popup-level).
   - Keep the `navigate(...)` call on Duplicate (navigates to
     `/personas/${duplicated.id}`) **only when not embedded** — pass an
     optional `onDuplicated?: (persona: DbPersona) => void` prop; the
     standalone page passes `(p) => navigate(`/personas/${p.id}`)`, the popup
     usages (Phase 2) can leave it `undefined` (duplicating from inside a
     CV-tab popup just stays on the original persona — no navigation makes
     sense there since there's no route to go to).
2. Update `src/pages/persona-detail.tsx`:
   - Keep the `useParams()`/`findPersona` guard and not-found `Empty` +
     "Back to Personas" button exactly as today (lines 88-130).
   - Replace everything after the guard with
     `<PersonaEditorPanel personaId={persona.id} onDuplicated={(p) => navigate(`/personas/${p.id}`)} />`
     wrapped in the same outer `<div className="flex flex-col gap-4">` that
     still holds the "Back to Personas" button above it.
   - Remove now-unused imports from this file (most of what moved to the
     panel) — keep only what the thinner wrapper still uses
     (`Link`/`useNavigate`/`useParams`, `Button`, the `Empty*` family,
     `UsersIcon`, `ArrowLeftIcon`, `findPersona`, `usePersonaStore`).

**Verification:**
- `npm run typecheck && npm run lint` clean.
- Manually confirm (or trace through code) that
  `/personas/:id?dialog=edit`, `?dialog=pool-picker&kind=work`, etc. still
  resolve to the same UI as before — the URL param names must be byte-for-byte
  unchanged for the standalone page (prefix stays `undefined` there).
- `grep -rn "PersonaDetailPage" src` still only matches
  `src/pages/persona-detail.tsx` and its route registration in `src/App.tsx`
  (unchanged).

---

## Phase 2 — `PersonaEditorDialog`

**What:** New component wrapping `PersonaEditorPanel` in a `Dialog`, with a
create-mode pre-step.

1. Create `src/components/persona/persona-editor-dialog.tsx`:
   ```ts
   export function PersonaEditorDialog({
     open,
     onOpenChange,
     mode,          // "create" | "edit"
     personaId,     // required when mode === "edit"
     onPersonaCreated,
   }: {
     open: boolean
     onOpenChange: (open: boolean) => void
     mode: "create" | "edit"
     personaId?: string
     onPersonaCreated?: (persona: DbPersona) => void
   })
   ```
   - Internal state: `const [createdId, setCreatedId] = React.useState<string | null>(null)`
     — tracks a persona created during this dialog session in `mode="create"`.
   - Reset `createdId` to `null` when `open` transitions `false → true` (same
     "seed on open transition" pattern `PersonaFormDialog` already uses at
     `persona-form-dialog.tsx:55-63` — copy that `wasOpen` pattern).
   - Effective id to render: `mode === "edit" ? personaId : createdId`.
   - If no effective id yet (create mode, not yet submitted): render the
     inline name/note/tags step — `Input` (name, autoFocus, Enter-to-submit),
     `NoteInput`, `TagInput` (same three fields/props `PersonaFormDialog`
     uses at lines 86-98), plus a "Create" `Button` that calls
     `createPersona(personaStore, { name, note, tags })`, then
     `setCreatedId(persona.id)` and `onPersonaCreated?.(persona)`.
   - Once there's an effective id: render
     `<PersonaEditorPanel personaId={effectiveId} dialogParamPrefix="persona" />`
     (no `onDuplicated` — see Phase 1 note).
   - `DialogContent className="max-h-[92vh] sm:max-w-5xl overflow-y-auto"`
     (copy `template-view-dialog.tsx:33`'s pattern, wider given the panel's
     2-column grid).
   - `DialogHeader`/`DialogTitle`: "Create Persona" while no effective id yet,
     otherwise the persona's own name (or "Edit Persona" — pick one, keep
     it simple: just the persona name once known, matching how the
     standalone page shows `persona.name` as its `<h1>`).
   - No custom footer "Save"/"Done" button needed — closing via the dialog's
     own X/overlay-click is enough (every field already writes through
     immediately, per spec's non-goals). Don't add a redundant "Save" button.

**Verification:**
- `npm run typecheck && npm run lint` clean.
- No new `useDialogSearchParams()` call without a prefix anywhere in this
  file (grep it).

---

## Phase 3 — Wire into `ApplicationCvSetup` (create flow)

**File:** `src/components/applications/application-cv-setup.tsx`

1. Import `PersonaEditorDialog` and `SelectSeparator`.
2. Add local state: `const [createOpen, setCreateOpen] = React.useState(false)`.
3. In the main return's Persona `Select` (lines 113-132): after the mapped
   `personaOptions`, add a `SelectSeparator` then a `SelectItem` with a
   sentinel value (e.g. `value="__create__"`, label "+ Create new persona…").
   In `onValueChange`, branch:
   ```ts
   onValueChange={(next) => {
     if (next === "__create__") {
       setCreateOpen(true)
       return
     }
     setPersonaId(next as string)
   }}
   ```
   (the `Select`'s controlled `value={personaId}` never becomes the
   sentinel, so nothing visually "sticks" on the create option).
4. In the `personaOptions.length === 0` empty state (lines 77-97), replace
   the current dead-end copy ("Create a Persona first — a CV always starts
   from one...") with the same "Create new persona" trigger — add a primary
   `Button` in `EmptyContent` alongside the existing "Import CV settings"
   button, calling `setCreateOpen(true)`.
5. Render `<PersonaEditorDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" onPersonaCreated={(persona) => setPersonaId(persona.id)} />`
   once, near the component's return (sibling to the `Empty` blocks — use a
   fragment or wrap the existing returns).

**Verification:**
- `npm run typecheck && npm run lint` clean.
- Trace: selecting "+ Create new persona…" opens the dialog; after typing a
  name and clicking "Create", the panel appears in place (same dialog);
  closing it leaves `personaId` state set to the new persona, visible in the
  Select's trigger text, and "Set up CV" becomes enabled (`canSubmit`).

---

## Phase 4 — Wire into `PersonaFieldTree` → `DataTab` (edit flow)

**File:** `src/components/cv/persona-field-tree.tsx`

1. In `DataTab` (currently lines 463-510): add
   `const [editOpen, setEditOpen] = React.useState(false)`.
2. Add an "Edit persona" `Button` (ghost or outline, `size="sm"`):
   - In the empty-state branch (`groups.length === 0`, lines 480-486) —
     replace the dead-end copy ("pick some from the Persona page first")
     with wording that reflects the new in-place flow (e.g. "No entries
     selected yet.") and add the button below it.
   - Also add the same button as a persistent header action above the
     `groups.map(...)` list (non-empty branch), e.g. a small flex row before
     line 489, so it's reachable once entries exist too.
3. Render `<PersonaEditorDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" personaId={personaId} />`
   once at the end of `DataTab`'s returned JSX (`personaId` is already
   destructured at line 469 after the `application.cvPersonaId` guard).

**Verification:**
- `npm run typecheck && npm run lint` clean.
- Trace: with an application that has a persona-backed CV and at least one
  selected section entry, opening the CV tab → Data tab shows "Edit persona";
  clicking it opens the dialog directly on that persona's full content (no
  create step, since `mode="edit"`).

---

## Phase 5 — Docs & cleanup

1. Update `docs/code-map.md`:
   - Under "Persona (dialogs, top-level list page uses these)" (around line
     118-122), add rows for `persona-editor-panel.tsx` and
     `persona-editor-dialog.tsx`.
   - Update the `persona-form-dialog.tsx` row if its description changes
     (it doesn't — still name/note/tags only, unchanged).
   - Update `pages.tsx` row for `persona-detail.tsx` if its one-line
     description needs adjusting to mention it's now a thin route wrapper.
   - Add a note under "Domain: Applications" near the
     `application-cv-setup.tsx` and CV tab entries mentioning the new
     "create/edit persona inline" popups, if it meaningfully changes what a
     reader would expect from those files.
2. Add a row to `docs/progress.md` for this initiative (spec 16 / plan 18),
   status "In progress" until Phase 4 verification passes, then "Done".
3. Final full-repo check: `npm run typecheck && npm run lint`.
4. Grep sanity checks:
   - `grep -rn "useDialogSearchParams()" src` — confirm no *new* unprefixed
     call was introduced beyond the pre-existing ones already in
     `application-detail-view.tsx` and `pages/persona-detail.tsx`/
     `pages/personas.tsx`.
   - `grep -rn "PersonaEditorPanel\|PersonaEditorDialog" src` — confirm each
     is used at exactly the call sites this plan describes (Phase 1 page
     wrapper, Phase 3 setup, Phase 4 data tab).

## Final Phase — Verification

- [ ] `npm run typecheck` clean
- [ ] `npm run lint` clean
- [ ] Standalone `/personas/:id` page behaves identically to before Phase 1
      (same URL params, same dialogs, same Duplicate-navigates-away behavior)
- [ ] `ApplicationCvSetup`: "+ Create new persona…" creates and auto-selects
      a persona without leaving the application
- [ ] `ApplicationCvSetup` empty state ("No Personas yet") offers the same
      create flow instead of a dead end
- [ ] CV tab → Data tab "Edit persona" opens the full editor for the
      application's current persona in place
- [ ] Post-setup Persona `<Select>` in `application-detail-view.tsx` is
      untouched (no "create new" option added there — out of scope per spec)
- [ ] `docs/code-map.md` and `docs/progress.md` updated
