# 16 — Inline persona editing in the Applications CV tab

## What

Two entry points to create/edit a Persona without leaving an application's CV
tab, both opening the same full Persona editor as a popup dialog instead of
navigating to `/personas/:id`:

1. **CV setup (`ApplicationCvSetup`)** — the Persona `<Select>` shown before
   an application has a CV gets a new option, "Create new persona…". Picking
   it opens the popup; once the persona is created (and, optionally, the user
   has populated some content and closes the popup), it becomes the selected
   value in the Persona `<Select>`, ready to submit with "Set up CV" as
   before.
2. **CV tab → Data tab (`PersonaFieldTree` → `DataTab`)** — an "Edit persona"
   action opens the same popup, pre-loaded with the application's current
   `cvPersonaId`, so section/content changes can be made in place.

Out of scope: the second Persona `<Select>` in `application-detail-view.tsx`
(the one used to switch personas *after* a CV is already set up) does not get
a "Create new persona" option — only the initial setup picker does.

## Why

Building out a Persona today requires leaving the application you're
tailoring a CV for, going to the standalone Personas page, and navigating
back. That's disruptive mid-tailoring — especially the common case of
starting a new application and realizing you want a persona variant that
doesn't exist yet. Popping the full editor up in place keeps the workflow
inside the application.

## Design

### Shared popup: `PersonaEditorDialog`

The existing `PersonaDetailPage` (`src/pages/persona-detail.tsx`) owns ~500
lines of real editor UI (Basics/Contact/Location/Social cards, per-section
pickers via `PoolPickerDialog`, skills-check, the Edit/Duplicate/Delete
dropdown) driven off `useParams()` and an unprefixed `useDialogSearchParams()`.
None of that logic is persona-editing-specific to being a route — it operates
on a `personaId` and the `PersonaStore`/`InventoryStore`, both available from
context anywhere in the tree.

Split it:

- **`src/components/persona/persona-editor-panel.tsx`** — new. The extracted
  body of `PersonaDetailPage` (everything from the header down: name/note/tags
  header + dropdown, Basics cards, Contact/Location/Social cards, section
  cards, "Used in Applications" card, and the three nested dialogs —
  `PoolPickerDialog`, `PersonaFormDialog` (edit/duplicate), `DeletePersonaDialog`,
  `SkillsCheckDialog`). Takes `personaId: string` and
  `dialogParamPrefix?: string` (passed straight through to
  `useDialogSearchParams(dialogParamPrefix)`) instead of reading `useParams()`
  directly. No "Back to Personas" link — that's page chrome, not content.
- **`src/pages/persona-detail.tsx`** — shrinks to the route wrapper: reads
  `useParams()`, the "Back to Personas" button, the not-found `Empty` state,
  and renders `<PersonaEditorPanel personaId={id} />` (no prefix — unchanged
  URL behavior, e.g. `?dialog=edit`).
- **`src/components/persona/persona-editor-dialog.tsx`** — new. Wraps
  `PersonaEditorPanel` in a large `Dialog` (`DialogContent` sized generously,
  e.g. `sm:max-w-5xl max-h-[90vh] overflow-y-auto` — this content is dense).
  Two modes:
  - `mode="edit"`, `personaId` given — renders the panel directly for that
    persona.
  - `mode="create"` — no persona yet. Shows a small inline name/note/tags
    step first (reusing `PersonaFormDialog`'s field set, not the dialog
    shell — just the fields, since we're already inside a dialog) with a
    "Create" button. On submit, calls `createPersona`, then swaps to
    rendering `PersonaEditorPanel` for the newly created persona's id in the
    same open dialog, so the user can immediately pick sections.
  - Always uses `dialogParamPrefix="persona"` for the nested panel, so its
    pool-picker/edit/duplicate/delete/skills-check state (`personaDialog`,
    `personaKind`, …) never collides with whatever dialog state the host
    page (`application-detail-view.tsx`) already manages under the plain
    `dialog` key.
  - Props: `open`, `onOpenChange`, `mode`, `personaId?`,
    `onPersonaCreated?: (persona: DbPersona) => void` — fired once, right
    after creation, so a caller can auto-select it (the popup stays open for
    further editing; auto-select doesn't imply auto-close).
  - Closing the dialog (X, overlay click, or an explicit "Done" button) just
    calls `onOpenChange(false)` — no separate "Save" step beyond what the
    panel already does today (every edit in `PersonaEditorPanel` writes
    through immediately, same as the standalone page).

### `ApplicationCvSetup` (create flow)

- Add a `"__create__"` sentinel `SelectItem` at the top of the Persona
  `SelectContent` (e.g. "+ Create new persona…", visually distinct — separate
  `SelectGroup` or a leading icon).
- `onValueChange`: if the value is the sentinel, don't set `personaId` to it —
  instead open `PersonaEditorDialog` (`mode="create"`).
- `onPersonaCreated={(persona) => setPersonaId(persona.id)}` — selects it in
  the existing `personaId` state so the Select reflects it once the popup
  closes (or immediately, since the Select re-renders from `personaId` state
  regardless of dialog open state).
- The empty state (`personaOptions.length === 0`, "No Personas yet") also
  gets a "Create new persona" button wired to the same dialog, replacing the
  current dead-end copy ("Create a Persona first").

### `PersonaFieldTree` → `DataTab` (edit flow)

- Add an "Edit persona" `Button` (ghost/outline, small) — placed in the
  `DataTab`'s existing empty-state ("No entries selected yet — pick some from
  the Persona page first" — update copy since it's no longer a page nav) and
  also as a persistent action at the top of the tab when there are entries,
  so it's reachable regardless of state.
- Opens `PersonaEditorDialog` (`mode="edit"`, `personaId={application.cvPersonaId}`).
  No `onPersonaCreated` needed — the application's `cvPersonaId` doesn't
  change from this flow.
- Guard: if `application.cvPersonaId` is null (shouldn't happen inside
  `DataTab`, which already early-returns in that case), the button doesn't
  render.

### Nesting/collision notes

- `PersonaEditorPanel`'s internal `useDialogSearchParams(dialogParamPrefix)`
  handles pool-picker/edit/duplicate/delete/skills-check as one mutually
  exclusive `dialog` value each, same as today — just namespaced.
  `PersonaEditorDialog`'s own open/close state is separate again (plain
  `useState` in both call sites, matching the existing `ImportCvSettingsDialog`
  pattern in `application-detail-view.tsx`, not URL-synced — a persona editor
  popup nested three levels deep doesn't need to survive a page refresh).
- Deleting the currently-selected persona from inside the "Edit persona" popup
  (Data tab flow) is left as-is: `DeletePersonaDialog` already surfaces the
  affected-application count as a warning. No new guard added — pre-existing
  behavior when deleting a persona in use.

## Non-goals

- No changes to the post-setup Persona `<Select>` in
  `application-detail-view.tsx` (switching personas on an existing CV).
- No draft/autosave-on-close semantics beyond what already exists — every
  field in the panel persists immediately, as it does on the standalone page.
- No changes to `PersonaFormDialog` itself (still used as-is for
  edit/duplicate inside the panel, and for the standalone Personas page).
