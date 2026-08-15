# 14 — Missing skills check

Builds on [spec 10](10-applications-tracking.md)'s Applications tracking and
[spec 02](02-inventory-data-model.md)'s inventory item model (skills are
`inventory_items` rows with `kind = 'skill'`, `title` as the skill name).

## Why

A job posting lists required skills; the user wants to know which of those aren't
covered — by their whole skill inventory, a specific Persona, or a specific CV —
before applying or tailoring. One reusable dialog does the check everywhere it's
needed: paste a list, click Check, see what's missing.

## Shared building blocks

- **`findMissingSkills(input: string, availableSkillTitles: string[]): string[]`**
  (new, `src/lib/skill-check.ts`) — pure function. Splits `input` on newlines, trims
  each line, drops blanks, dedupes case-insensitively (keeping first-seen casing),
  then returns the lines with no case-insensitive exact match in
  `availableSkillTitles`. No substring/fuzzy matching — `"React.js"` does not match
  an inventory skill titled `"React"`.
- **`SkillsCheckDialog`** (new, `src/components/skills/skills-check-dialog.tsx`) — a
  controlled dialog reused across all three contexts below:
  ```ts
  {
    open: boolean
    onOpenChange: (open: boolean) => void
    availableSkills: string[]        // the compare pool, resolved by the caller
    value: string                    // textarea contents — owned by the caller
    onValueChange: (value: string) => void
    result: string[] | null          // last computed missing-skills list, owned by the caller
    onCheck: () => void              // caller recomputes `result` (and persists, if applicable)
    saving?: boolean                 // Applications only — disables Check while persisting
  }
  ```
  Renders a `Textarea` ("Paste required skills, one per line") + Check button, and,
  once `result` is non-null, an inline output directly in the dialog: destructive
  `Badge`s (one per missing skill, `TriangleAlert` icon) or a neutral "All covered"
  state when `result` is `[]`. The dialog itself never fetches or persists anything —
  callers own `value`/`result` state and what `onCheck` does with them.

## Compare pool per context

| Context | Pool source |
|---|---|
| Application | The attached CV's **resolved, visibility-filtered** skills: `resolveApplicationCv(...).document`'s `skill` section, flattened across `skillGroups[].skills`. Disabled (dialog trigger disabled with a hint) if no CV is attached. |
| CV page (`cv-print.tsx`) | Same source, for the CV already loaded on that page — its resolved `document`'s `skill` section, `skillGroups[].skills` flattened. Already reflects that CV's own field-visibility overrides. |
| Persona detail page | The persona's full selected skill items — `selectedEntriesOf(persona, inventory, personaId, "skill").map(i => i.title)`. Personas carry no field-visibility of their own (that moved to CVs — see `move_field_visibility_to_cvs` migration), so this is simply everything picked into the persona's Skills section. |

## Per-context behavior

### Applications (persisted)

- New DB columns on `applications`: `required_skills_input` (text, nullable) and
  `missing_skills` (text[], nullable — `null`, not `[]`, when nothing was missing).
- Trigger: a button in `ApplicationDetailView`'s Job Detail tab (near CV/Apply via),
  opening `SkillsCheckDialog`. `value`/`result` are owned by the detail view,
  initialized from `application.requiredSkillsInput`/`application.missingSkills`.
- **Check** (inside the dialog) only recomputes `result` locally and shows it in the
  dialog — it does not touch the database. A separate **Save** button, shown only in
  this context (passed as an extra affordance, not part of the shared dialog's own
  footer — see Plan for exact placement), persists both `required_skills_input` and
  `missing_skills` via a new `application.ts` mutator. `saving` disables Check/Save
  while the request is in flight.
- Outside the dialog, the Job Detail tab also gets a new `DetailField` ("Missing
  skills") showing the persisted `missing_skills` the same way (destructive Badges +
  `TriangleAlert`), so the result is visible without reopening the dialog. `null` →
  `"—"`.

### CV page (ephemeral)

- Trigger: a button in `cv-print.tsx`'s header row (alongside Export/Print).
- `value`/`result` are plain `useState` on `CvResolved` (or a small wrapper) —
  in-memory only, reset on navigation/refresh, never sent to Supabase.
- No display outside the dialog — closing it without rechecking just hides the last
  result; reopening shows whatever `value`/`result` state is still held in memory
  (lost only on a full page reload).

### Persona detail page (ephemeral)

- Trigger: a button in the Skills section's `CardHeader` (next to the existing
  `PickButton`, in `persona-detail.tsx`).
- Same ephemeral local-state treatment as the CV page — no DB fields, no display
  outside the dialog.

## Out of scope

- No auto-check on save/load or on a schedule — always a manual click.
- No autocomplete/suggestions while typing the textarea.
- No fuzzy/synonym matching (e.g. "JS" ↔ "JavaScript") — exact normalized match only.
- Persona/CV contexts never write to the database for this feature — confirmed
  explicitly: local component state only, gone on refresh.
