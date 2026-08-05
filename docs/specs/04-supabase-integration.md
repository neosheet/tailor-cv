# 04 — Supabase Integration

What it takes to stop reading from `src/mocks/` and start reading from a real Supabase
project. The table shapes are already decided — [02 — Inventory Data
Model](02-inventory-data-model.md) and [03 — CV Selection](03-cv-selection.md) are the
schema. This spec is the remaining what/why: what actually gets built in this pass, in
what order, and what is deliberately left on mocks a while longer.

## Goal

Replace `src/mocks/` with a real Supabase (Postgres + Auth) backend, for everything the
app currently does — not everything the app will ever do. Nothing here designs new
product features; it wires up what's already built.

## Scope: what "current implementation progress" means

Per `docs/progress.md`, the app today is:

- **Basics** (row 12) — real add/edit/delete forms, the only pool with actual mutations.
- **Tags** (row 11) — real add/rename/delete registry, in Settings.
- **The other 12 Inventory pools** (row 07) — list pages only, read-only, Add/Edit/Delete
  disabled.
- **CVs** (row 09) — two hand-authored mock CVs, list + print preview. No CV builder UI
  exists yet — selections are authored data, not something a user creates on screen.

So "stop using mock data" means: every one of those reads comes from Supabase, and the
two things that already write (Basics, Tags) write to Supabase instead of mutating the
in-memory array. It does **not** mean building the CV builder, Import/Export, Trash, or
anything else `docs/progress.md` doesn't already mark done — those stay exactly as
speculative as they are today. When they get built, they read/write the same tables this
spec sets up.

## Decisions

### 1. Auth: real, single account

RLS in spec 02/03 is written entirely against `auth.uid()`. There's no version of "wire
up the data" that skips auth — a policy with no session behind it returns nothing, and
disabling RLS to dodge that defeats the point of using Supabase at all.

The app gets real Supabase Auth (email/password) and exactly one account: the user's
own. No signup flow, no invite system — the account is created once via the Supabase
dashboard or CLI. Every route sits behind a session check; signed-out shows a login
screen, nothing else. `UserMenu`'s `placeholderUser` and disabled "Sign out" (currently
stubbed, `src/components/layout/user-menu.tsx:32`) become real.

This costs little now and avoids a second migration later — RLS policies already assume
a real `user_id`, so building for one real user is the same shape as building for many.

### 2. Schema: apply 02 + 03 as-is, minus soft delete

Tables, enums, triggers, indexes, and RLS policies from spec 02 and spec 03 get applied
via Supabase migrations, with one deliberate omission: **no `deleted_at`, no
`live_items`/`live_lines` views.** Spec 02 marks soft delete (spec 08) "Spec only" —
mocks hard-delete today (`src/mocks/index.ts` `deleteItem` splices the array), and this
pass matches current behavior rather than building ahead of it. Adding the column later
is a plain migration; building the views and partial indexes now for a feature nothing
uses yet is the kind of speculative work the workflow says to avoid.

Everything else — `profiles`, `inventory_items`, `inventory_lines`, `item_skills`,
`tags`, `cvs`, `cv_sections`, `cv_items`, `cv_lines` — goes in as specced, RLS on from
the first migration.

### 3. Seed data: the existing mock dataset, inserted for real

"Generate mock data" doesn't mean inventing a second dataset — `src/mocks/data/*`
(Arya Nugraha, 68 items / 165 lines / 45 skill links / 47 tags, see
`src/mocks/README.md`) is already a complete, deliberately over-supplied demo profile
shaped exactly like spec 02. It becomes the seed: a one-time script reads the same
`data/` source files, resolves them through the existing `flatten.ts`, and inserts the
result into Supabase under the real account's `user_id`, generating real UUIDs in place
of the readable slug ids (`work-lumbung` → a `uuid`) per the note in the mocks README.

`src/mocks/data/cvs.ts` seeds `cvs` / `cv_sections` / `cv_items` / `cv_lines` the same
way, so the two demo CVs exist in the database too.

The seed script is a one-shot dev tool, not app code — it doesn't ship in the bundle.

### 4. Data access: keep the seam, change what's behind it

`src/mocks/index.ts` was already built as the swap point — its own comments say so
("mirrors what a Supabase `update` will do", "swapping it for real Supabase queries
later should be a like-for-like replacement"). This pass honors that: a new
`src/lib/inventory.ts` (naming TBD at plan time) exports the same function shapes —
`itemsOfKind`, `linesOf`, `skillsOf`, `entriesUsingSkill`, `linesWithTag`, `createItem`,
`updateItem`, `deleteItem`, `toggleFavorite`, plus the tag-registry equivalents from
`src/mocks/tags.ts` — backed by `supabase-js` calls instead of array filters. Components
that already consume these (`PoolPanel`, `BasicsItemDialog`, `item-detail-dialog`,
`TagInput`, pool pages) change their import, not their logic.

Async is the one real shape change: mock selectors return synchronously, Supabase calls
don't. Callers become `async`/await Supabase, or reads move behind a small data-fetching
pattern (plain `useEffect` + state, since no query library is installed and this app
doesn't need one yet for this volume of data).

### 5. Rollout order

1. Supabase project, env vars (`.env.local`, Vercel env), `supabase-js` client, one
   migration applying schema minus soft delete.
2. Auth: login screen, session/route guard, real `UserMenu`.
3. Seed script run once against the real project.
4. Basics pool cut over first (it already has full CRUD — the best end-to-end proof the
   wiring works) and verified live in the browser.
5. Tags registry (Settings) cut over.
6. The other 12 Inventory pool list pages cut over to real reads (they stay read-only —
   Add/Edit/Delete were never wired for them and this pass doesn't change that).
7. CVs list + print preview cut over to real reads.
8. `src/mocks/` stops being imported by any page. The folder itself can be deleted or
   kept as the seed script's source — decide at that point, not now.

### 6. What stays out of scope

- CV builder UI, Import/Export, Trash/soft-delete UI, Applications/snapshots — none of
  these exist today, so none of them get built here. Their tables (`cv_*`) get created
  because spec 03 is settled and the mock CVs need somewhere to live, but no new UI is
  built for them beyond what already exists (list + print preview).
- Multi-user support beyond "the schema happens to allow it" — no signup, no invites.
- Realtime, Storage, Edge Functions — nothing in the current app needs them.

## Open points

1. **Where the seed script lives and how it's run** (`scripts/seed.ts` via `tsx`? a
   Supabase SQL migration with literal inserts?) — an implementation detail, settle at
   plan time.
2. **Data-fetching pattern for reads** — plain `useEffect`, or is this the point a small
   fetch wrapper earns its place? Low stakes at this data volume; decide at plan time
   rather than here.
3. **Whether `src/mocks/` is deleted or kept as seed-script source** once nothing else
   imports it (step 8 above) — deferred until that step is reached.
