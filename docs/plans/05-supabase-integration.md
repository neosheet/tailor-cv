# Supabase integration

## Context

Spec: [`docs/specs/04-supabase-integration.md`](../specs/04-supabase-integration.md),
built on [`02-inventory-data-model.md`](../specs/02-inventory-data-model.md) and
[`03-cv-selection.md`](../specs/03-cv-selection.md).

The app runs entirely on `src/mocks/` today. Per `docs/progress.md`: Basics
(row 12) has real add/edit/delete forms and is the only pool with mutations; Tags
(row 11) has a real registry CRUD in Settings; the other 12 Inventory pools (row 07)
are read-only lists; CVs (row 09) are two hand-authored mock documents with a list +
print preview, no builder UI. This plan makes all of that read from and write to a
real Supabase project instead of the in-memory `mockDb`, and nothing more —
no CV builder, Import/Export, Trash, or Applications, since none of those exist to
migrate (spec 04, "What stays out of scope").

**Known conflict to check before starting:** `git status` shows uncommitted changes
to `basics-item-dialog.tsx`, `item-detail-dialog.tsx`, `pool-panel.tsx`,
`tag-input.tsx`, plus an untracked `.claude/worktrees/dialog-audit/` — an in-flight
dialog-pattern refactor touching the same files this plan edits later. Confirm that
work is committed or stashed before Phase 6, so this plan isn't racing it.

## Allowed APIs (Phase 0 discovery)

Gathered from the `supabase` and `supabase-postgres-best-practices` skills plus live
`search_docs` lookups. Cite these; don't invent alternatives.

**Client** — `createClient<Database>(url, key)` from `@supabase/supabase-js`. Vite
exposes only `VITE_`-prefixed env vars via `import.meta.env` (not `NEXT_PUBLIC_` —
that's Next-only). Use the **publishable** key client-side, never the secret/service
key. Singleton lives at `src/lib/supabase.ts`.

**Auth** — `supabase.auth.signInWithPassword({ email, password })`,
`supabase.auth.getSession()`, `supabase.auth.onAuthStateChange((event, session) => …)`
(register early, per the skill's explicit warning), `supabase.auth.signOut()`. No
Supabase doc prescribes a react-router guard specifically — this app has none of
Next's middleware/RSC, so the guard is plain React: a session held in context, a
wrapper component that redirects to `/login` via `<Navigate>` when the session is
null. Not doc-verified beyond the primitives above; standard React practice.

**Migrations** — `supabase migration new <name>` → `supabase/migrations/
<timestamp>_<name>.sql`. Iterate locally with the CLI / MCP `execute_sql` (does not
write migration history — use for iteration, not final application). Check
`get_advisors` before calling it done. Push to the hosted project with
`supabase db push` (`--dry-run` first). MCP `apply_migration` is for a filesystem-less
flow — this repo has a filesystem, so migrations are files, applied via CLI, not that
tool.

**RLS nuances beyond `auth.uid()`** (spec 02/03 already write policies correctly per
these, confirm on write):
- Views need `security_invoker = true` (spec 02 already does this for `live_items`/
  `live_lines`, which this plan skips per spec 04 decision 2 — but any other view
  added must do the same).
- An `update` policy needs both a `using` **and** a `with check` clause — `using`
  alone lets a row's `user_id` be reassigned away from its owner.
- `to authenticated` + an ownership predicate together — `to authenticated` alone is
  not authorization.
- No `security definer` functions unless unavoidable; prefer `security invoker`.

**Queries** — `.from(table).select()/.insert()/.update()/.delete()` all return
`{ data, error }` — check `error` on every call, no exceptions thrown to catch.
Generate types: `npx supabase gen types typescript --project-id <ref> --schema public
> src/lib/database.types.ts` (or `--local` against the dev stack); pass the generated
`Database` type into `createClient<Database>`.

**Seeding** — the documented convention is `supabase/seed.sql` (raw SQL, auto-applied
by `supabase db reset` / `db push --include-seed`). That doesn't fit here: the seed
source is `src/mocks/data/*.ts`, resolved through the existing `flatten()` function
before insert, not raw SQL. This plan uses a one-off Node/TS script instead
(`scripts/seed.ts`, run via `tsx`), authenticated with the **secret/service-role** key
from an untracked `.env` — never the publishable key, never committed, never
bundled. This is inferred from general Supabase key-usage guidance, not a specific
doc page — flagged as such.

**Anti-patterns called out explicitly by the skill** — service-role key in any
client-bundled file; disabling RLS to make a query "just work"; `auth.role() =
'authenticated'` instead of a `to authenticated` clause; an `update`/`insert` policy
missing `with check`; a new table left off the Data API / without `grant`s (a
separate step from RLS).

## Codebase surface (Phase 0 discovery, continued)

**Routing** — `src/App.tsx:1,28-59`, react-router v8 classic `<Routes>`/`<Route>`
(not the data router). Every route nests under one `<Route element={<AppLayout />}>`
at `App.tsx:30` — that's the single wrap point for a session guard. `AppLayout`
(`src/components/layout/app-layout.tsx:8-22`) has no auth logic today.
`cvs/:cvId/print` (`App.tsx:51`) renders outside sidebar chrome via CSS but is still
inside the same guarded route, so one guard covers it.

**No existing env/config to preserve** — no `import.meta.env` usage anywhere, no
`.env*` files, no `vite-env.d.ts`, `vite.config.ts` has no `envDir`/`envPrefix`. This
is greenfield.

**`src/mocks/tags.ts` exports** (registry — Settings Tags UI and `TagInput`):
`TAG_NAME_PATTERN` (line 23, `/^[a-z0-9]+$/`), `TagUsage` type (25-31),
`normaliseTagName(raw)` (56), `validateTagName(raw, {except?})` (66),
`listTags(): TagUsage[]` (89), `usageOfAny(names): Omit<TagUsage,"name">` (103),
`createTag(raw): string` (125), `renameTag(from, raw): string` (142),
`deleteTag(name): void` (171).

**`src/mocks/index.ts` exports** (inventory items/lines — every pool):
`mockDb` (57), `toggleFavorite(itemId): boolean` (87), `createItem(kind, input):
DbInventoryItem` (133), `updateItem(itemId, patch): DbInventoryItem` (172),
`deleteItem(itemId): void` (199), `byFavouriteThenPosition(a,b): number` (210),
`itemsOfKind(kind): DbInventoryItem[]` (224), `linesOf(itemId, listKind):
DbInventoryLine[]` (231), `allLinesOf(itemId): DbInventoryLine[]` (238),
`skillsOf(itemId): DbInventoryItem[]` (243), `entriesUsingSkill(skillId):
DbInventoryItem[]` (254), `linesWithTag(tag): DbInventoryLine[]` (267),
`BASICS_KINDS` (280), `contactDetails(item)` (298), `locationDetails(item)` (316),
`formatLocation(item): string` (332), `poolCounts(): Record<ItemKind, number>` (341).

**`src/mocks/cv.ts` exports**: `allCvs(): DbCv[]` (134), `findCv(cvId)` (138),
`cvsUsingItem(itemId): ItemUsage[]` (164), `cvUsageCount(itemId): number` (182),
`buildResumeDocument(cvId): ResumeDocument` (272). Reads entirely off `mockDb` from
`./index` (items/lines/itemSkills already in memory).

**Every `@/mocks` import, grouped** (full cutover checklist):

| Area | Files | What they import |
|---|---|---|
| Basics | `src/pages/inventory/basics.tsx:8-13`, `basics-item-dialog.tsx:41-48` | `itemsOfKind`, `contactDetails`, `locationDetails`, `createItem`, `updateItem` |
| Shared pool infra (used by **every** pool, Basics included) | `pool-panel.tsx:26-33`, `item-detail-dialog.tsx:38-46`, `pool-table.tsx:30`, `columns.tsx:8-9`, `pool-columns.tsx:10`, `pool-page.tsx:4` | `byFavouriteThenPosition`, `deleteItem`, `toggleFavorite`, `allLinesOf`, `skillsOf`, `linesOf`, `itemsOfKind`, `cvsUsingItem`, `cvUsageCount`, types |
| Tags (Settings) | `src/components/settings/tags-panel.tsx:34-41`, `tag-dialogs.tsx:26`, `src/lib/tag-copy.ts:1` (type-only) | `createTag`, `deleteTag`, `listTags`, `renameTag`, `validateTagName` |
| Tag picker | `src/components/inventory/tag-input.tsx:17` | `createTag`, `listTags`, `validateTagName` |
| CVs | `src/pages/cvs.tsx:14`, `cv-print.tsx:17`, `templates.tsx:9`, `add-to-cv-dialog.tsx:21-22` | `allCvs`, `buildResumeDocument`, `findCv`, `cvsUsingItem` |
| Type-only (no runtime change needed beyond the import path) | `src/components/cv/*` (resume-render, template-card, template-view-dialog, templates/*), `src/lib/cv-templates.ts:5` | `ResumeDocument`, `ResumeSection`, `ResumeEntry` types |

**The `PoolPanel`/`PoolTable` CRUD seam** (`pool-panel.tsx:90-118`,
`pool-table.tsx:52-74`): `formKind?: BasicsKind` and `onDataChanged?: () => void` are
what currently gate Add/Edit/Delete — only Basics sets them, so the other 12 pools
render Add/Edit/Delete disabled today. **Favourite-toggle is not gated by
`formKind`** — every pool already calls live `toggleFavorite` through the shared
`PoolPanel`. This matters for sequencing below: `toggleFavorite`, `allLinesOf`,
`skillsOf`, `linesOf` are genuinely shared code paths, not Basics-only, so they
cannot be cut over "for Basics only" at the component level without threading new
props through every pool — out of scope per spec 04. They cut over once, for every
pool simultaneously, in Phase 6.

**No test runner** — `package.json` scripts are `dev`, `build`, `lint`, `typecheck`,
`format`, `preview`. Verification throughout is `typecheck` + `lint` + manual browser
checks, no automated test suite.

## Architecture decision: keep the in-memory selector pattern, swap what feeds it

`columns.tsx`'s cell renderers call `linesOf(itemId, listKind)` **synchronously**
inside a table cell (e.g. to show "3 highlights" inline). A live Supabase call per
cell can't work there — cell rendering isn't async.

So this plan does **not** turn every mock function into an async Supabase call.
Instead:

- One fetch, once per session (after auth resolves): pull `inventory_items`,
  `inventory_lines`, `item_skills`, and `tags` for the signed-in user into a local
  store — a React context holding the same shape as today's `mockDb`
  (`{ items, lines, itemSkills, tags }`).
- Every existing **pure** selector (`itemsOfKind`, `linesOf`, `allLinesOf`,
  `skillsOf`, `entriesUsingSkill`, `linesWithTag`, `byFavouriteThenPosition`,
  `contactDetails`, `locationDetails`, `formatLocation`, `poolCounts`,
  `cvsUsingItem`, `cvUsageCount`, `buildResumeDocument`) gets ported nearly verbatim
  into `src/lib/inventory.ts` / `src/lib/cv.ts`, reading the fetched store instead of
  the static mock arrays. **Stays synchronous.** `columns.tsx` and every other
  consumer needs zero logic changes, only an import-path swap.
- Only the **mutators** (`createItem`, `updateItem`, `deleteItem`, `toggleFavorite`,
  `createTag`, `renameTag`, `deleteTag`) become async: call Supabase, then update the
  local store on success so every selector reading it reflects the change
  immediately (same "mutate in place" pattern the mocks already use, per
  `docs/plans/04-inventory-basics-forms.md`'s `favouriteVersion` counter precedent).

This is what makes the spec's per-pool rollout order (Basics → Tags → other pools →
CVs) meaningful as a *verification* order even though the underlying store and
selector swap lands in one phase (6) — every consumer keeps working the moment the
store is populated; the phases below are about proving each area still behaves
correctly, not about literally deploying them independently.

## Phase 1 — Supabase project, client, env

- Confirm or create the Supabase project (`mcp__claude_ai_Supabase__create_project`
  / `get_project` / `get_project_url` / `get_publishable_keys`).
- `npm install @supabase/supabase-js`.
- `.env.local` (gitignored): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
  Add both to Vercel project env vars (production + preview) — flag to the user
  before touching Vercel settings, that's a shared-system change.
- `src/lib/supabase.ts`: `export const supabase = createClient<Database>(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)`.
  `Database` type is a placeholder export until Phase 2 generates it for real.
- `src/vite-env.d.ts`: `ImportMetaEnv` interface declaring the two vars, so
  `import.meta.env.VITE_SUPABASE_URL` typechecks.

**Verify**: `npm run typecheck` passes with the new file; `supabase.ts` imports
nothing from `src/mocks`.

## Phase 2 — Schema migrations

- `supabase migration new inventory_schema` — write spec 02's tables (`profiles`,
  `inventory_items`, `inventory_lines`, `item_skills`, `tags`) and RLS **as specced,
  minus `deleted_at` and the `live_items`/`live_lines` views** (spec 04 decision 2 —
  mocks hard-delete today, so the schema matches that rather than building ahead of
  it). Include the `item_kind`/`line_kind` enums, all `check` constraints, the
  `assert_tags_registered` trigger, `touch_updated_at` trigger, and every index from
  spec 02's Indexes section (minus the two partial-index/`deleted_at` ones that only
  exist for soft delete).
- `supabase migration new cv_schema` — spec 03's `cvs`, `cv_sections`, `cv_items`,
  `cv_lines`, their RLS, the `cv_line_belongs_to_item` trigger, and indexes — same
  soft-delete omission (`cvs.deleted_at` dropped).
- Iterate locally via CLI/`execute_sql` (not `apply_migration` — this repo has a
  filesystem, use the file-based workflow); run `get_advisors` before treating either
  migration as final; `supabase db push --dry-run` then `supabase db push` to the
  real project.
- `npx supabase gen types typescript --project-id <ref> --schema public >
  src/lib/database.types.ts`; wire it into `createClient<Database>` from Phase 1.

**Verify**: `list_tables` shows all 9 tables with RLS enabled; `get_advisors` returns
no unaddressed security warnings; `database.types.ts` compiles.

## Phase 3 — Auth

- One real account, created once via the Supabase dashboard (email/password) — no
  signup UI.
- `src/lib/auth-context.tsx`: a context seeded by `getSession()` on mount, updated
  via `onAuthStateChange`, exposing `{ session, loading }`.
- `src/pages/login.tsx`: email/password form, `signInWithPassword`, redirect to `/`
  on success. Use existing `Field`/`Input`/shadcn primitives, not new custom markup.
- Route guard wrapping `App.tsx:30`'s `<Route element={<AppLayout />}>`: render
  nothing (or a loading state) while `loading`, `<Navigate to="/login" />` when no
  session, `<Outlet />` otherwise. Add a sibling `<Route path="login" element={<LoginPage />}>` outside the guard.
- `src/components/layout/user-menu.tsx`: replace `placeholderUser` (lines 32-37)
  with the real session's email/derived initials; wire the disabled "Sign out" item
  (line ~105) to `supabase.auth.signOut()` + redirect to `/login`.

**Verify**: signed-out browser hits any route → lands on `/login`; correct
credentials → lands on the dashboard; sign-out from the menu returns to `/login`;
`npm run typecheck && npm run lint` clean.

## Phase 4 — Data-access layer

Port the pure selectors and build the store, per the architecture decision above.

- `src/lib/inventory-store.tsx`: a context/provider that, once `session` exists,
  fetches `inventory_items`, `inventory_lines`, `item_skills` for that user in one
  round trip (or a few parallel ones) and holds them in state shaped like today's
  `mockDb`. Mount this provider inside the auth-guarded layout (Phase 3), so it
  fetches once per session, not per page.
- `src/lib/inventory.ts`: port `itemsOfKind`, `linesOf`, `allLinesOf`, `skillsOf`,
  `entriesUsingSkill`, `linesWithTag`, `byFavouriteThenPosition`, `contactDetails`,
  `locationDetails`, `formatLocation`, `poolCounts`, `BASICS_KINDS`,
  `BasicsItemInput` type — same signatures as `src/mocks/index.ts`, reading from the
  store instead of the static arrays.
- `src/lib/inventory.ts` mutators: `createItem`, `updateItem`, `deleteItem`,
  `toggleFavorite` — each does the Supabase `.insert()`/`.update()`/`.delete()`
  (checking `{ error }` per the doc-cited pattern), then updates the store on
  success. Same call shape as today (`createItem(kind, input)`, etc.) so callers in
  `basics-item-dialog.tsx` don't change beyond `await`ing them.
- `src/lib/tags.ts`: port `TAG_NAME_PATTERN`, `TagUsage`, `normaliseTagName`,
  `validateTagName` (pure, no store needed — validation only), `listTags`,
  `usageOfAny` (read from the store's fetched `tags` + usage counts against
  `items`/`lines`), and async `createTag`/`renameTag`/`deleteTag` hitting Supabase
  then updating the store — `renameTag`/`deleteTag` must run the same multi-statement
  transaction spec 02 describes (registry row + both content tables) inside one
  Supabase RPC or sequential calls guarded by a check, not three unguarded round
  trips.
- `src/lib/cv.ts`: port `allCvs`, `findCv`, `cvsUsingItem`, `cvUsageCount`,
  `buildResumeDocument` — reads `cvs`/`cv_sections`/`cv_items`/`cv_lines` fetched
  alongside the inventory store (or lazily per CV, since only 2 exist today; decide
  based on what's simpler once the inventory fetch pattern is proven).

**Verify**: `npm run typecheck` — every ported function's signature matches its mock
counterpart exactly (grep `src/mocks/index.ts` and `tags.ts` export signatures
against the new files to confirm nothing was dropped or renamed silently).

## Phase 5 — Seed script

- `scripts/seed.ts`, run via `tsx` (add as a devDependency + an npm script, e.g.
  `"seed": "tsx scripts/seed.ts"` — not shipped in the app bundle).
- Imports the existing `src/mocks/data/*` source files and `flatten()` unchanged,
  producing the same `{ items, lines, itemSkills }` the app already computes for
  the demo dataset (68 items / 165 lines / 45 skill links, per
  `src/mocks/README.md`), plus `src/mocks/data/cvs.ts` for the two demo CVs.
- Replaces the readable slug ids (`work-lumbung`) with real `crypto.randomUUID()`
  values per spec 04 decision 3 and the mocks README's own note — keep a slug→uuid
  map while inserting so nested rows (`item_id`, `skill_id`, `cv_id` references) get
  the right generated id.
- Uses `createClient` with the **secret/service-role key** read from an untracked
  `.env` (`SUPABASE_SECRET_KEY` or similar, never `VITE_`-prefixed so it can't leak
  into the client bundle), targeting the one real account's `user_id`.
- Insert order respects foreign keys: `tags` registry rows first (content tables'
  `tags text[]` values must already exist there per the `assert_tags_registered`
  trigger), then `inventory_items`, then `inventory_lines`, then `item_skills`, then
  `cvs`/`cv_sections`/`cv_items`/`cv_lines`.

**Verify**: run once against the real project; `list_tables`/`execute_sql` row
counts match the mocks README table (68 items, 165 lines, 45 skill links, 47 tags,
2 CVs); re-running the script is expected to fail on unique constraints (it's a
one-shot tool, not idempotent — note this in the script's own comment rather than
building idempotency nothing else needs).

## Phase 6 — Cut over the app

Swap `@/mocks` imports to the new modules, file by file, per the table in Phase 0.
Order matters for verifying incrementally even though the store (Phase 4) makes
every consumer correct the moment it's populated:

1. **Shared pool infrastructure first** — `pool-panel.tsx`, `item-detail-dialog.tsx`,
   `pool-table.tsx`, `columns.tsx`, `pool-columns.tsx`, `pool-page.tsx`: swap imports
   to `src/lib/inventory.ts`/`src/lib/cv.ts`. This alone brings every pool's reads
   and favourite-toggle onto Supabase, since they're shared (see Phase 0 finding).
2. **Basics** — `src/pages/inventory/basics.tsx`, `basics-item-dialog.tsx`: swap
   imports; `createItem`/`updateItem` calls become `await`ed. Verify full CRUD
   round-trip live in the browser first — it's the only pool with a write UI to
   exercise, and it's the load-bearing proof the mutator path works end to end.
3. **Tags (Settings)** — `tags-panel.tsx`, `tag-dialogs.tsx`, `tag-input.tsx`: swap
   imports to `src/lib/tags.ts`; `listTags()`'s initial `React.useState(listTags)`
   (`tags-panel.tsx:53`) needs to become an effect/loading-state read since the
   store fetch is async on first mount. Verify add/rename/delete round-trip live.
4. **Other 12 pools** — no code beyond step 1's shared-infra swap; verify each pool
   page (`work.tsx`, `education.tsx`, …) still renders its rows, favourite-toggle
   still works, detail dialog still shows lines/skills correctly. Add/Edit/Delete
   stay disabled exactly as today (`formKind` still unset) — out of scope per spec
   04, unchanged by this plan.
5. **CVs** — `cvs.tsx`, `cv-print.tsx`, `templates.tsx`, `add-to-cv-dialog.tsx`: swap
   imports to `src/lib/cv.ts`; verify the two seeded demo CVs list and print-preview
   correctly, `buildResumeDocument` output matches what mocks produced (same
   sections, same selected bullets).

**Verify per step**: `npm run typecheck && npm run lint` after each file group;
browser check per the "Verifying UI work" section of CLAUDE.md (one desktop
screenshot per changed page + console-error check) before moving to the next step.

## Phase 7 — Remove `src/mocks/` from the app

- `grep -rn "from \"@/mocks\|from \"\.\./mocks\|from \"\./mocks" src/` returns
  nothing outside `scripts/seed.ts` (which legitimately still imports
  `src/mocks/data/*` and `flatten` as its seed source, per spec 04 decision 3).
- Decide then (per spec 04 open point 3) whether to delete `src/mocks/index.ts`,
  `cv.ts`, `tags.ts`, `types.ts` (superseded by `src/lib/*`) while keeping
  `src/mocks/data/*` + `flatten.ts` as the seed script's source, or restructure —
  don't decide this now, decide when the grep above is actually clean.
- Update `docs/progress.md` row for this initiative to "Done" once this phase
  completes, following the same pattern as every other row in that table.

## Final Phase — Verification

- `npm run typecheck && npm run lint` clean on the full repo.
- `get_advisors` on the Supabase project — zero unaddressed security/RLS warnings.
- Grep for anti-patterns: no `service_role`/secret key outside `scripts/seed.ts` and
  `.env` (`grep -rn "SUPABASE_SECRET\|service_role" src/` → empty), no
  `SUPABASE_URL`/key literals hardcoded outside `.env`/`import.meta.env` reads.
- Browser walkthrough, one pass: sign in → Basics add/edit/delete → Tags
  add/rename/delete → each of the other 12 pool pages loads and favourite-toggles →
  both CVs list and print-preview correctly → sign out returns to `/login`.
- Confirm `docs/progress.md` reflects the finished state and this plan file is
  linked from it, matching every other row's format.
