# Code map

Reference index of important files, grouped by domain. Goal: jump straight to
the right file instead of scanning the tree. Not exhaustive (skips
`components/ui/*` shadcn primitives individually, trivial one-liners) — add an
entry whenever a new file earns its own mental model.

**Keep this in sync:** whenever a file listed here is added, removed, renamed,
or its responsibility materially changes, update this file in the same change.

## Entry / routing

| File | Purpose |
|---|---|
| `src/main.tsx` | App bootstrap |
| `src/App.tsx` | Route table — every page is wired here; `RequireAuth` wraps authenticated routes in the three store providers |
| `src/lib/auth-context.tsx` | Supabase auth session provider, `useAuth()` |
| `src/lib/navigation.ts` | Nav/breadcrumb metadata: `inventoryPages`, `sections`, `findPageByPath`, `getBreadcrumbTrail` |

## Layout shell

| File | Purpose |
|---|---|
| `src/components/layout/app-layout.tsx` | Authenticated shell: sidebar + header + route outlet |
| `src/components/layout/app-sidebar.tsx` | Nav sidebar, driven by `navigation.ts` |
| `src/components/layout/app-header.tsx`, `page-header.tsx`, `user-menu.tsx`, `nav-card.tsx`, `placeholder-page.tsx` | Header bar, page title/actions row, account menu, linked section-nav cards (used by Inventory index), empty-state placeholder |
| `src/components/dashboard/stat-card.tsx`, `applications-heatmap.tsx` | Dashboard-only widgets: linked totals tile, GitHub-style "applications applied per day" calendar heatmap with hover tooltips |
| `src/lib/application-heatmap.ts` | `buildApplicationHeatmap` — buckets `applied_at` timestamps into a week/weekday grid with relative intensity levels, for `applications-heatmap.tsx` |

## Pages (`src/pages/`)

| File | Purpose |
|---|---|
| `dashboard.tsx` | Home/landing page |
| `login.tsx` | Auth login page |
| `not-found.tsx` | 404 |
| `settings.tsx` | Settings hub — tags, skill categories, stage templates panels |
| `personas.tsx` / `persona-detail.tsx` | Persona list / persona editor route wrapper (`persona-detail.tsx` is now a thin `useParams` + not-found-guard shell — the actual editor content is `components/persona/persona-editor-panel.tsx`, shared with the popup opened from the Applications CV tab) |
| `applications.tsx` / `application-detail.tsx` | Application list (kanban/list) / detail page — the CV tab prints/exports in place, no separate print route |
| `inventory/index.tsx` | Inventory landing (links to each item-kind page) |
| `inventory/{basics,work,education,skills,languages,projects,volunteer,awards,certificates,publications,interests,references}.tsx` | One page per inventory item kind — thin wrappers around `pool-page.tsx` |
| `inventory/import-export.tsx` | Bulk inventory import/export |

## Domain: Inventory (raw CV data pool)

| File | Purpose |
|---|---|
| `src/lib/inventory.ts` | Core inventory data helpers: `itemsOfKind`, `linesOf`, `skillsOf`, `entriesUsingSkill`, tag/line queries |
| `src/lib/inventory-store.tsx` | `InventoryStoreProvider` — Supabase CRUD + state for all inventory item kinds |
| `src/lib/item-kind-config.ts` | Per-`ItemKind` config shared by the item form, detail view, and pool table columns: `KIND_FIELDS`, `KIND_LINE_KINDS`, `SKILL_LINK_KINDS`, `KIND_LABELS` — one source of truth per kind instead of three independently hand-maintained tables |
| `src/lib/tags.ts` | Tag name validation/normalisation, `listTags`, usage lookup |
| `src/lib/tag-copy.ts` | Tag copy/duplication helper |
| `src/lib/skill-categories.ts` | Skill category CRUD helpers, usage counts |
| `src/components/inventory/pool-page.tsx` | Generic list-page shell reused by every inventory kind page |
| `src/components/inventory/pool-table.tsx`, `pool-columns.tsx`, `pool-table-skeleton.tsx`, `columns.tsx` | Table rendering, column defs, loading skeleton |
| `src/components/inventory/pool-panel.tsx`, `pool-picker-dialog.tsx` | Reusable inventory panel, item picker dialog |
| `src/components/inventory/item-dialog.tsx`, `item-detail-dialog.tsx` | Add/edit item form dialog, read-only detail view |
| `src/components/inventory/add-to-persona-dialog.tsx` | Attach inventory item(s) to a persona |
| `src/components/inventory/bulk-category-dialog.tsx`, `bulk-tags-dialog.tsx` | Bulk actions on selected rows |
| `src/components/inventory/category-filter.tsx`, `tag-filter.tsx`, `tag-input.tsx` | Filter/input controls |
| `src/components/inventory/line-list-editor.tsx`, `note-input.tsx`, `partial-date-picker.tsx`, `skill-link-input.tsx` | Field-level editors used inside `item-dialog.tsx` |
| `src/components/inventory/use-pool-data.ts` | Hook: filtering/sorting/selection state for a pool table |

## Domain: Persona & CV (tailoring + templates)

CV ownership (persona/template + overrides) lives directly on `applications`
now, not a standalone `cvs` table/page — see the Applications domain below
for the mutators and `persona-field-tree/`'s application-facing editor.
This section covers what's still persona/template-only.

| File | Purpose |
|---|---|
| `src/lib/persona.ts` | Persona/CV data helpers: field visibility, item usage across personas |
| `src/lib/persona-store.tsx` | `PersonaStoreProvider` — Supabase CRUD + state for personas and saved `cv_templates` |
| `src/lib/cv-templates.ts` | Built-in + saved template registry: `cvTemplates`, `findTemplate`, `allTemplates` |
| `src/lib/cv-template-core.ts` | Style resolution (`resolveStyleObject`), template node/block traversal, and `NodeOverride` application (`lookupNodeOverride`, `applyStyleTextOverride`) shared by the renderer and the baker — `Style`/`StyleDef` re-exported from schema.ts, not redeclared |
| `src/lib/cv-template-schema.ts` | Template type definitions: `TemplateDefinition`, `ElementNode`, `BlockInstanceNode`, `RepeatNode`, `PageConfig`, `NodeOverride` — the format's type source of truth |
| `src/lib/cv-template-bake.ts` | `bakeTemplateSettings` — flattens style/page/block overrides into a standalone saved template, via the same `applyStyleTextOverride` the renderer uses (except the block-instance clone-on-bake case, which is bake-specific — see the function's docstring) |
| `src/lib/cv-template-defs/{classic,classic-compact,two-column,batch1-demo}.ts` | Built-in template definitions — `classic-compact` is Classic's layout with a `cv-templates.ts` `defaultFieldVisibility` that hides Experience's location/workplace type/employment type/description by default |
| `src/lib/style-property-schema.ts`, `page-property-schema.ts` | Editable style/page property metadata driving the template property editor UI |
| `src/lib/resume-document.ts` | `ResumeDocument`/`ResumeSection`/`ResumeEntry` types — the rendered-CV data shape |
| `src/lib/cv-snapshot.ts`, `cv-snapshot-download.ts` | CV snapshot (versioned) serialization/parsing, export/download to PDF — `buildCvSnapshot` takes a narrow `{name, note, tags, templateSettings}` shape, not a table row |
| `src/lib/quill-html.ts`, `sanitize-html.ts` | Rich-text (Quill) HTML conversion + sanitization |
| `src/components/cv/persona-field-tree/` | Field-visibility/style/page/node override editor for one application's CV (used on the Applications detail view's CV tab, not persona-detail — takes `application: DbApplication`, not a `cvs` row). `index.tsx` is the `Tabs` shell (`PersonaFieldTree` export); `visibility-tab.tsx`/`data-tab.tsx`/`style-tab.tsx`/`page-tab.tsx`/`block-tab.tsx` are one file per tab; `shared.tsx` holds row primitives (`ParentRow`/`LeafRow`/`EyeToggle`/`ReorderButtons`) and `PropertyRow`, used by 2+ tabs |
| `src/components/cv/save-as-new-template-dialog.tsx` | "Save as new template" dialog, calls `saveAsNewTemplate` (`lib/application.ts`) |
| `src/components/cv/template-card.tsx`, `template-view-dialog.tsx` | Template-agnostic preview card + full-preview dialog, reused from the CV tab (no more standalone Templates gallery page) |
| `src/components/cv/template-node-renderer.tsx`, `templates/index.tsx`, `resume-render.tsx` | Template tree → DOM rendering (`resume-render.tsx` is the print/preview renderer) |
| `src/components/cv/preview-select.tsx` | Preview mode/zoom selector |

## Domain: Applications

| File | Purpose |
|---|---|
| `src/lib/application.ts` | Application CRUD helpers, `resolveApplicationCv`/`setGlobalApplicationStatus` (the freeze). Also owns CV ownership now (docs/specs/15-cv-embedded-in-applications.md): the field-visibility/style/page/node override mutators (`setKindHidden`, `setFieldHidden`, `setItemHidden`, `setCvStyleProperty`/`resetCvStyleProperty`, `setCvPageProperty`/`resetCvPageProperty`, `setCvNodeOverride`/`resetCvNodeOverride`), `setApplicationCvBase` (lazy CV setup), `copyApplicationCvSettings` (Import), and `saveAsNewTemplate` — all formerly on the deleted `lib/cv.ts`, retargeted at `applications` |
| `src/lib/application-store.tsx` | `ApplicationStoreProvider` — Supabase CRUD + state for applications/stages |
| `src/lib/application-stage.ts` | Stage tree helpers: `stagesForApplication`, stage form/update field types |
| `src/lib/application-status.ts`, `application-job-type.ts`, `application-work-type.ts` | Enum labels/options for application metadata |
| `src/lib/stage-category.ts`, `stage-progress-status.ts`, `stage-templates.ts` | Stage taxonomy + reusable stage template CRUD |
| `src/components/applications/application-list-panel.tsx`, `application-kanban-panel.tsx` | List view / kanban board of applications |
| `src/components/applications/application-cv-setup.tsx` | The CV tab's lazy-setup empty state — Persona + Template picker (via `setApplicationCvBase`) or Import CV settings from another application, shown whenever `resolveApplicationCv` returns nothing yet. The Persona picker's "+ Create new persona…" opens `PersonaEditorDialog` and auto-selects the result (docs/specs/16-inline-persona-editing-in-cv-tab.md) |
| `src/components/applications/application-detail-view.tsx`, `application-detail-sheet.tsx` | Full detail page content, and its reuse as a slide-over sheet |
| `src/components/applications/application-form-dialog.tsx`, `delete-application-dialog.tsx`, `archive-application-dialog.tsx` | Create/edit, delete, archive dialogs |
| `src/components/applications/similar-applications-dialog.tsx` | Non-blocking "similar applications found" dialog (`findSimilarApplications`, matched on Company only) — shown after creating a matching application. Also exports `DuplicateApplicationsList`, the shared row markup reused by `application-check-button.tsx` |
| `src/components/applications/application-check-button.tsx` | Self-contained top-of-page "Check" button + dialog — runs `checkApplication` (duplicate Company, missing skills vs. saved required-skills input, position vs. CV headline) and shows all three results together |
| `src/components/applications/vacancy-detail-content.tsx`, `vacancy-detail-editor.tsx` | Job posting/vacancy info display + editor |
| `src/components/applications/stage-card.tsx`, `stage-form-dialog.tsx`, `stage-name-input.tsx`, `new-stage-template-dialog.tsx` | Stage pipeline UI |
| `src/components/applications/timeline-tab.tsx` | Application activity/stage timeline |
| `src/components/applications/deadline-date-picker.tsx`, `interviewer-names-input.tsx` | Field-level inputs |

## Settings

| File | Purpose |
|---|---|
| `src/components/settings/tags-panel.tsx`, `tag-dialogs.tsx` | Global tag management |
| `src/components/settings/skill-categories-panel.tsx`, `skill-category-dialogs.tsx` | Skill category management |
| `src/components/settings/stage-templates-panel.tsx`, `stage-template-dialogs.tsx` | Reusable stage template management |
| `src/components/settings/entity-dialog-shells.tsx` | `RenameDialogShell`/`DeleteConfirmDialogShell` — the Dialog/AlertDialog layout skeleton shared by the three registries' rename/delete dialogs above. Each registry keeps its own validation, field set, and copy; only the wrapper markup is shared |
| `src/components/settings/registry-table.tsx` | `RegistryTable` — the search-filtered table + hover rename/delete actions shared by Skill Categories and Stage Templates. Tags keeps its own bespoke table (checkbox column, bulk-selection bar, merge flow don't compose cleanly here) |

## Persona (dialogs, top-level list page uses these)

| File | Purpose |
|---|---|
| `src/components/persona/persona-form-dialog.tsx`, `delete-persona-dialog.tsx` | Name/note/tags dialog and delete-confirm dialog (used from `pages/personas.tsx` and inside `persona-editor-panel.tsx`) |
| `src/components/persona/persona-editor-panel.tsx` | The full persona editor content (Basics/Contact/Location/Social cards, per-section pickers, "Used in Applications") — extracted from `pages/persona-detail.tsx` so it can be reused inside a popup. Takes `personaId` + an optional `dialogParamPrefix` (namespaces its internal pool-picker/edit/duplicate/delete/skills-check URL state when nested) |
| `src/components/persona/persona-editor-dialog.tsx` | Popup wrapper around `persona-editor-panel.tsx` — `mode="edit"` renders it directly for a given persona; `mode="create"` shows an inline name/note/tags step first, then swaps to the panel for the newly created persona. Used by `application-cv-setup.tsx` (create, from the Persona picker) and `cv/persona-field-tree/data-tab.tsx` ("Edit persona") |

## Shared UI / hooks

| File | Purpose |
|---|---|
| `src/components/ui/*` | shadcn/ui primitives — extend via the `shadcn` skill, don't hand-build |
| `src/components/search-input.tsx`, `external-link.tsx`, `theme-provider.tsx` | Small shared building blocks |
| `src/components/skills/skills-check-dialog.tsx` | Reusable "paste required skills, see what's missing" dialog — controlled, no fetch/persist of its own. Used by Application detail (persisted) and Persona detail (ephemeral) |
| `src/lib/skill-check.ts` | `findMissingSkills` (case-insensitive line-diff) and `skillTitlesOf` (flattens a resolved `ResumeDocument`'s skill section) — shared by the two `SkillsCheckDialog` call sites |
| `src/hooks/use-dialog-search-params.ts`, `use-tab-search-param.ts` | URL-synced UI state (open dialogs, active tab) |
| `src/hooks/use-skills-check.ts` | `useSkillsCheck` — shared `value`/`result`/`onCheck`/`reset` state for the three `SkillsCheckDialog` callers; dialog open/close and persistence stay with each caller |
| `src/hooks/use-session-state.ts`, `use-mobile.ts` | sessionStorage-backed state, mobile breakpoint detection |

## Data & backend

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/store-context.ts` | Shared scaffold for the three `*-store.tsx` providers: `toError`, `useRefetchVersion`, `useStoreContext` — the fetch-effect body and per-field state stay in each store, only the identical wrapper pieces are shared |
| `src/lib/database.types.ts` | Generated Supabase types — regenerate via Supabase MCP, never hand-edit |
| `supabase/migrations/*.sql` | Schema history, chronological by timestamp filename |
| `src/mocks/*` | Dev/seed mock data (personas, work, education, skills, projects, misc), `flatten.ts`, `types.ts` |

## Docs (`docs/`)

| File | Purpose |
|---|---|
| `docs/specs/NN-*.md` | What/why per feature, written before planning |
| `docs/plans/NN-*.md` | Phased how-to plans from `/make-plan` |
| `docs/progress.md` | Single running status index across initiatives |
| `docs/user-request/*.md` | Raw working notes per user request |
| `docs/code-map.md` | This file |
