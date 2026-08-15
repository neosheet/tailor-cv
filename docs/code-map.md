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
| `src/components/layout/app-header.tsx`, `page-header.tsx`, `user-menu.tsx`, `nav-card.tsx`, `placeholder-page.tsx` | Header bar, page title/actions row, account menu, dashboard nav cards, empty-state placeholder |

## Pages (`src/pages/`)

| File | Purpose |
|---|---|
| `dashboard.tsx` | Home/landing page |
| `login.tsx` | Auth login page |
| `not-found.tsx` | 404 |
| `settings.tsx` | Settings hub — tags, skill categories, stage templates panels |
| `personas.tsx` / `persona-detail.tsx` | Persona list / persona editor (field visibility tree, print settings, save-as-template) |
| `cv.tsx` / `cv-print.tsx` | CV list & builder / standalone print-render route |
| `applications.tsx` / `application-detail.tsx` / `application-cv-print.tsx` | Application list (kanban/list) / detail page / print route for an application's CV |
| `inventory/index.tsx` | Inventory landing (links to each item-kind page) |
| `inventory/{basics,work,education,skills,languages,projects,volunteer,awards,certificates,publications,interests,references}.tsx` | One page per inventory item kind — thin wrappers around `pool-page.tsx` |
| `inventory/import-export.tsx` | Bulk inventory import/export |

## Domain: Inventory (raw CV data pool)

| File | Purpose |
|---|---|
| `src/lib/inventory.ts` | Core inventory data helpers: `itemsOfKind`, `linesOf`, `skillsOf`, `entriesUsingSkill`, tag/line queries |
| `src/lib/inventory-store.tsx` | `InventoryStoreProvider` — Supabase CRUD + state for all inventory item kinds |
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

| File | Purpose |
|---|---|
| `src/lib/persona.ts` | Persona/CV data helpers: field visibility, item usage across personas |
| `src/lib/persona-store.tsx` | `PersonaStoreProvider` — Supabase CRUD + state for personas, CVs, and saved `cv_templates` |
| `src/lib/cv.ts` | CV CRUD, `resolveCv` (persona + template + overrides → renderable CV), `saveAsNewTemplate` |
| `src/lib/cv-templates.ts` | Built-in + saved template registry: `cvTemplates`, `findTemplate`, `allTemplates` |
| `src/lib/cv-template-core.ts` | Style resolution (`resolveStyleObject`), template node/block traversal |
| `src/lib/cv-template-schema.ts` | Template type definitions: `TemplateDefinition`, `ElementNode`, `BlockInstanceNode`, `RepeatNode`, `PageConfig` |
| `src/lib/cv-template-bake.ts` | `bakeTemplateSettings` — flattens style/page/block overrides into a standalone saved template |
| `src/lib/cv-template-defs/{classic,two-column,batch1-demo}.ts` | Built-in template definitions |
| `src/lib/style-property-schema.ts`, `page-property-schema.ts` | Editable style/page property metadata driving the template property editor UI |
| `src/lib/resume-document.ts` | `ResumeDocument`/`ResumeSection`/`ResumeEntry` types — the rendered-CV data shape |
| `src/lib/cv-snapshot.ts`, `cv-snapshot-download.ts` | CV snapshot (versioned) serialization/parsing, export/download to PDF |
| `src/lib/quill-html.ts`, `sanitize-html.ts` | Rich-text (Quill) HTML conversion + sanitization |
| `src/components/cv/cv-list-panel.tsx`, `cv-form-dialog.tsx`, `delete-cv-dialog.tsx` | CV list, create/edit dialog, delete confirm |
| `src/components/cv/persona-field-tree.tsx` | Field-visibility tree editor for a persona (used on `persona-detail.tsx`) |
| `src/components/cv/save-as-new-template-dialog.tsx` | "Save as new template" dialog, calls `saveAsNewTemplate` |
| `src/components/cv/template-card.tsx`, `templates-panel.tsx`, `template-view-dialog.tsx` | Template gallery, picker panel, preview dialog |
| `src/components/cv/template-node-renderer.tsx`, `templates/index.tsx`, `resume-render.tsx` | Template tree → DOM rendering (`resume-render.tsx` is the print/preview renderer) |
| `src/components/cv/preview-select.tsx` | Preview mode/zoom selector |

## Domain: Applications

| File | Purpose |
|---|---|
| `src/lib/application.ts` | Application CRUD helpers, `resolveApplicationCv` |
| `src/lib/application-store.tsx` | `ApplicationStoreProvider` — Supabase CRUD + state for applications/stages |
| `src/lib/application-stage.ts` | Stage tree helpers: `stagesForApplication`, stage form/update field types |
| `src/lib/application-status.ts`, `application-job-type.ts`, `application-work-type.ts` | Enum labels/options for application metadata |
| `src/lib/stage-category.ts`, `stage-progress-status.ts`, `stage-templates.ts` | Stage taxonomy + reusable stage template CRUD |
| `src/components/applications/application-list-panel.tsx`, `application-kanban-panel.tsx` | List view / kanban board of applications |
| `src/components/applications/application-detail-view.tsx`, `application-detail-sheet.tsx` | Full detail page content, and its reuse as a slide-over sheet |
| `src/components/applications/application-form-dialog.tsx`, `delete-application-dialog.tsx`, `archive-application-dialog.tsx` | Create/edit, delete, archive dialogs |
| `src/components/applications/similar-applications-dialog.tsx` | Non-blocking "similar applications found" dialog, shown after creating one whose Company + URL match an existing application (`findSimilarApplications`) |
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

## Persona (dialogs, top-level list page uses these)

| File | Purpose |
|---|---|
| `src/components/persona/persona-form-dialog.tsx`, `delete-persona-dialog.tsx` | Create/edit and delete persona dialogs (used from `pages/personas.tsx`) |

## Shared UI / hooks

| File | Purpose |
|---|---|
| `src/components/ui/*` | shadcn/ui primitives — extend via the `shadcn` skill, don't hand-build |
| `src/components/search-input.tsx`, `external-link.tsx`, `theme-provider.tsx` | Small shared building blocks |
| `src/components/skills/skills-check-dialog.tsx` | Reusable "paste required skills, see what's missing" dialog — controlled, no fetch/persist of its own. Used by Application detail (persisted), CV page, and Persona detail (both ephemeral) |
| `src/lib/skill-check.ts` | `findMissingSkills` (case-insensitive line-diff) and `skillTitlesOf` (flattens a resolved `ResumeDocument`'s skill section) — shared by the three `SkillsCheckDialog` call sites |
| `src/hooks/use-dialog-search-params.ts`, `use-tab-search-param.ts` | URL-synced UI state (open dialogs, active tab) |
| `src/hooks/use-session-state.ts`, `use-mobile.ts` | sessionStorage-backed state, mobile breakpoint detection |

## Data & backend

| File | Purpose |
|---|---|
| `src/lib/supabase.ts` | Supabase client init |
| `src/lib/database.types.ts` | Generated Supabase types — regenerate via Supabase MCP, never hand-edit |
| `supabase/migrations/*.sql` | Schema history, chronological by timestamp filename |
| `src/mocks/*` | Dev/seed mock data (personas, work, education, skills, projects, cvs, misc), `flatten.ts`, `types.ts` |

## Docs (`docs/`)

| File | Purpose |
|---|---|
| `docs/specs/NN-*.md` | What/why per feature, written before planning |
| `docs/plans/NN-*.md` | Phased how-to plans from `/make-plan` |
| `docs/progress.md` | Single running status index across initiatives |
| `docs/user-request/*.md` | Raw working notes per user request |
| `docs/code-map.md` | This file |
