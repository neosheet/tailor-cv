# 20 — Chrome quick-add extension

Spec: [specs/18-chrome-quick-add-extension.md](../specs/18-chrome-quick-add-extension.md)

## Phase 0 — Documentation discovery (findings)

Consolidated from a research pass over the CRXJS/Supabase/Chrome docs and this
repo's own config. These are the resolved answers to the spec's two open
items plus the supporting APIs the phases below build on.

**MV3 build tooling — `@crxjs/vite-plugin`.** `npm view` confirms its
`peerDependencies.vite` covers `^8.0.0`, so it's compatible with this repo's
Vite 8; it's framework-agnostic so React 19 is fine too. Standard shape:

```ts
// vite.config.ts
import { defineConfig } from "vite"
import { crx } from "@crxjs/vite-plugin"
import manifest from "./manifest.json"
export default defineConfig({ plugins: [crx({ manifest })] })
```
```json
// manifest.json
{ "manifest_version": 3, "name": "tailor-cv quick add", "version": "1.0.0",
  "action": { "default_popup": "src/popup.html" } }
```
No content script, no background service worker — popup-only is sufficient
(see auth section below for why a background worker isn't needed just for
token refresh).

**Supabase custom storage adapter.** `createClient(url, key, { auth: {
storage, persistSession, autoRefreshToken, detectSessionInUrl } })`.
`storage` must implement `getItem`/`setItem`/`removeItem` — Promise-returning
implementations are supported (this is the same shape Supabase's own React
Native `AsyncStorage` adapter uses), so a thin wrapper around
`chrome.storage.local.get`/`set`/`remove` works directly. Set
`detectSessionInUrl: false` (no OAuth redirect flow here — email/password
only). Known gotcha (Supabase GitHub issue #2030): client init can throw if
storage is empty/freshly cleared — wrap `createClient` usage/`getSession()`
in try/catch and treat failure as signed-out rather than crashing the popup.
Popup fully unmounting on close (unlike a persistent background page) is not
a problem: Supabase re-reads the session from `chrome.storage.local` on next
`getSession()` when the popup reopens; no background worker needed solely to
keep a refresh timer alive.

**`chrome.tabs` + permissions.** `chrome.tabs.query({active: true,
currentWindow: true})` returns `Promise<Tab[]>` in MV3. `activeTab` alone is
sufficient to read `.url` — opening the popup (clicking the toolbar icon)
is itself the qualifying user gesture that activates `activeTab`; the
broader `tabs` permission is not needed. MV3's default `extension_pages` CSP
(`script-src 'self' 'wasm-unsafe-eval'; object-src 'self';`) doesn't
restrict `connect-src`, so `fetch` from the popup to the Supabase URL works
without a `host_permissions` entry.

**Tailwind v4 / shadcn reuse.** Root `src/index.css` is the copy-source for
tokens: `@import "tailwindcss"; @import "tw-animate-css"; @import
"shadcn/tailwind.css"; @import "@fontsource-variable/geist";` plus a
`@theme inline { ... }` block and `:root`/`.dark` OKLCH variables. Root
`vite.config.ts` uses the `@tailwindcss/vite` plugin (not PostCSS). shadcn
components here are plain source files, not an installed package, so the
primitives needed (`button.tsx`, `input.tsx`, `field.tsx`, `label.tsx`,
`separator.tsx`, `card.tsx`) can be copied as-is into
`extension/src/components/ui/`. Verified their only shared internal
dependency is `cn` (`src/lib/utils.ts`, itself just `clsx` + `tailwind-merge`,
no other imports) — `field.tsx` additionally needs `label.tsx` and
`separator.tsx`; `button.tsx`/`input.tsx` wrap `@base-ui/react` primitives, so
that package becomes an extension dependency too.

**Allowed APIs for this plan** (don't invent alternatives):
`chrome.storage.local.get/set/remove`, `chrome.tabs.query`,
`supabase.auth.signInWithPassword`, `supabase.auth.signOut`,
`supabase.auth.getSession`, `supabase.auth.onAuthStateChange`,
`supabase.from("applications").insert(...).select().single()` (mirrors
`createApplication` in `src/lib/application.ts:222`),
`supabase.from("applications").select("id, created_at").eq("source_url",
...)` (duplicate check), `cleanLinkedInJobUrl`
(`src/lib/linkedin-job-url.ts`), `VacancyDetailEditor`
(`src/components/applications/vacancy-detail-editor.tsx`).

**Anti-patterns to avoid:** no `tabs` permission (only `activeTab`); no
`host_permissions` entry for Supabase; no background service worker; no
`localStorage` for session persistence; no reinventing the Quill toolbar
(reuse `VacancyDetailEditor` verbatim via relative import); no pulling in
`react-day-picker`/`DeadlineDatePicker` for the post-date field — use a plain
native `<input type="date">` styled through the copied shadcn `Input`,
per the "simpler UI" goal (this is a deliberate scope call, not an
oversight — the full date picker is unnecessary weight for a one-field
popup).

## Phase 1 — Scaffold `extension/`

**Implement:**
- `extension/package.json` — standalone project, own `npm install`. Scripts:
  `dev` (`vite`), `build` (`tsc -b && vite build`), `typecheck` (`tsc -b`),
  `lint` (`eslint .`). Dependencies: `@supabase/supabase-js` (match root's
  `^2.112.1`), `react`/`react-dom` (match root's `^19.2.6`), `@base-ui/react`,
  `class-variance-authority`, `clsx`, `tailwind-merge`, `react-quill-new`
  (for the reused `VacancyDetailEditor`), `date-fns` if `VacancyDetailEditor`
  or `linkedin-job-url.ts` needs it (check imports before adding — don't
  add unused deps). Dev dependencies: `@crxjs/vite-plugin`, `vite@^8`,
  `@vitejs/plugin-react`, `@tailwindcss/vite`, `tailwindcss@^4`,
  `typescript`, `@types/chrome`, `@types/react`, `@types/react-dom`, eslint +
  `typescript-eslint` + `eslint-plugin-react-hooks` +
  `eslint-plugin-react-refresh` (copy root's `eslint.config.js` pattern,
  scoped to `extension/`).
- `extension/manifest.json` — `manifest_version: 3`, `name`, `version`,
  `action.default_popup: "src/popup.html"`, `action.default_icon` +
  top-level `icons` pointing at a placeholder icon set (any simple PNG at
  16/48/128px is fine — without one the toolbar shows a generic puzzle-piece
  icon, hard to spot among other loaded extensions), `permissions:
  ["activeTab", "storage"]` (`storage` for `chrome.storage.local`), no
  `host_permissions`, no `background`.
- `extension/vite.config.ts` — `crx({ manifest })` + `@vitejs/plugin-react` +
  `@tailwindcss/vite`, `@` alias → `./src` (matching root's convention).
  Because `extension/` imports live files from `../src/` (outside its own
  project root), also set `server.fs.allow` to include the repo root (e.g.
  `[searchForWorkspaceRoot(process.cwd())]` or an explicit `["..", "."]`) —
  without this, `npm run build` can still succeed (rollup bundling isn't
  gated by the dev-server's fs middleware) while `npm run dev` 403s on the
  same imports. Verify both, not just build.
  **Compatibility risk:** `@crxjs/vite-plugin`'s `peerDependencies` range
  covers Vite 8, but that's a declared range, not a build anyone has
  necessarily exercised against this exact Vite 8 version — CRXJS has
  historically lagged behind major Vite bumps. If `npm install` /
  `npm run build` fails or the plugin misbehaves (stale manifest injection,
  broken HMR) after a reasonable troubleshooting pass, fall back to a
  plugin-free approach instead of stalling Phase 1: a plain Vite multi-page
  build (`build.rollupOptions.input` pointing at `src/popup.html`) plus
  `vite-plugin-static-copy` (or a manual post-build `cp`) to place
  `manifest.json` into `dist/` — MV3 doesn't require a bundler plugin, just
  a `dist/` folder shaped like the manifest expects.
- `extension/tsconfig.json` (+ `tsconfig.node.json` if needed for
  `vite.config.ts`) — copy root `tsconfig.app.json`'s compiler options
  (`target`, `lib`, `moduleResolution: "bundler"`, `strict`, etc.), `@/*` →
  `./src/*` path, `include: ["src"]`. Since files are pulled in via relative
  import from `../src/`, either add `"../src/**/*"` awareness isn't needed —
  Vite/tsc resolve relative imports regardless of `include`, but confirm no
  `rootDir` restriction blocks it (drop `rootDir` if the default causes a
  TS6059 "not under rootDir" error against `../src` imports).
- `extension/src/popup.html`, `extension/src/main.tsx`, `extension/src/App.tsx`
  — placeholder shell only in this phase (e.g. a static "tailor-cv quick add"
  heading), no auth/form logic yet.
- `extension/src/index.css` — copy root `src/index.css`'s
  `@theme`/token block verbatim so the copied shadcn primitives render with
  the same design tokens.
- Root `eslint.config.js`: add `extension` to `globalIgnores` (alongside
  `dist`) so root `npm run lint` doesn't try to lint a sibling project with
  its own `node_modules`/tsconfig. Root `tsconfig.json`'s references stay
  unchanged (don't add `extension` as a project reference) — root
  `npm run typecheck` must keep passing untouched.
- Update `docs/code-map.md`: add an `## Chrome extension (extension/)` section
  pointing at the new folder and its key files (filled in as later phases add
  them).

**Verification:**
- `cd extension && npm install && npm run build` succeeds, producing `dist/`
  with a `manifest.json` and popup bundle.
- Load `extension/dist` via `chrome://extensions` → "Load unpacked" → toolbar
  icon opens the placeholder popup with no console errors.
- From repo root: `npm run typecheck && npm run lint` still pass unaffected
  by the new folder.

## Phase 2 — Supabase client + auth

**Implement:**
- `extension/src/lib/chrome-storage-adapter.ts` — implements the
  `storage` interface `createClient`'s `auth.storage` option expects
  (`getItem`/`setItem`/`removeItem`, each wrapping `chrome.storage.local`
  in a `Promise`).
- `extension/src/lib/supabase.ts` — `createClient<Database>(url, key, {
  auth: { storage: chromeStorageAdapter, persistSession: true,
  autoRefreshToken: true, detectSessionInUrl: false } })`, reading
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY` from `extension/.env`
  (same values as the root app's `.env.local` — copy them into a new
  `extension/.env.local`, gitignored same as root's). Import `Database` type
  via relative path from `../../src/lib/database.types` for insert
  type-safety. Wrap client/session init in try/catch per the Phase 0
  gotcha, treating a throw as signed-out.
- `extension/src/lib/auth-context.tsx` — small session provider mirroring
  `src/lib/auth-context.tsx`'s shape (`session`, `loading`) but backed by
  this extension's own `supabase` client.
- `extension/src/components/login-view.tsx` — email/password form, copied
  structurally from `src/pages/login.tsx` (same fields/validation/error
  display), calling `supabase.auth.signInWithPassword`. No sign-up flow
  (personal-use, account already exists).
- `extension/src/App.tsx` — renders `LoginView` when signed out, otherwise
  the (still-placeholder) main view from Phase 1, plus a sign-out button
  (`supabase.auth.signOut()`) visible once signed in.
- Copy shadcn primitives identified in Phase 0 into
  `extension/src/components/ui/`: `button.tsx`, `input.tsx`, `field.tsx`,
  `label.tsx`, `separator.tsx`, `card.tsx`. Copy `extension/src/lib/utils.ts`
  (`cn`) too.

**Verification:**
- `npm run build` in `extension/`, reload unpacked extension: popup shows
  login form when signed out; correct credentials sign in and the session
  persists after closing/reopening the popup (verify via closing the popup,
  reopening — should skip the login form); sign-out returns to the login
  form.
- `cd extension && npm run typecheck && npm run lint` pass.

## Phase 3 — Add-application form

**Implement:**
- `extension/src/components/add-application-view.tsx` — the main
  signed-in view. Fields: Company (`Input`, required), Position (`Input`,
  required), Post date (native `<input type="date">` styled via the copied
  `Input`), URL (`Input`, preseeded — see below — cleaned via
  `cleanLinkedInJobUrl` on blur, matching
  `application-form-dialog.tsx`'s existing behavior), Vacancy detail
  (`VacancyDetailEditor`, imported via relative path from
  `../../../src/components/applications/vacancy-detail-editor`).
- URL preseed: on mount, `chrome.tabs.query({active: true, currentWindow:
  true})`, take `tabs[0]?.url ?? ""`, run it through `cleanLinkedInJobUrl`,
  set as the URL field's initial value (still editable) — **unless a saved
  draft exists** (see below), in which case the draft's own URL wins and the
  live-tab URL is not applied (a mid-entry draft shouldn't get silently
  clobbered by whatever tab happens to be active on reopen).
- **Draft autosave** (`extension/src/lib/draft-storage.ts`, backed by
  `chrome.storage.local` under a dedicated key, e.g. `draft-application`):
  debounced save of all five field values on every change. On mount, if a
  draft exists, restore it into the form (taking priority over the URL
  preseed, per above) and show a small "Draft restored" indicator. A
  "Clear draft" button/link next to Save lets the user manually wipe the
  draft and reset the form to a fresh, freely-preseeded state (distinct
  from the automatic clear-on-successful-save below — this is for
  abandoning an in-progress draft on purpose, not just after saving it).
- **Duplicate check**: before insert, query
  `supabase.from("applications").select("id, created_at").eq("source_url",
  trimmedSourceUrl).limit(1)` (RLS already scopes this to the signed-in
  user). If a match is found, show a non-blocking inline warning ("Already
  added on {date}") next to the URL field — Save remains enabled; this is a
  heads-up, not a hard block, since a re-application to the same posting is
  a legitimate case.
- Save handler: validate company/position non-empty (mirror
  `application-form-dialog.tsx`'s `canSubmit` check), derive `title` as
  `` `${position} at ${company}` `` (no manual title override field in this
  reduced form — matches spec's field list), then
  `supabase.from("applications").insert({ user_id, title, company, position,
  deadline, source_url, vacancy_detail, global_status: "draft" }).select().single()`
  — mirrors `createApplication` (`src/lib/application.ts:222`) but inlined
  directly (no `ApplicationStore`/React-context dependency pulled in, per
  spec's "just a direct insert call" decision). `user_id` from
  `session.user.id`.
- On successful save: clear the draft from `chrome.storage.local`, reset
  the form with a fresh URL preseed for the current tab (in case the user
  saves multiple listings from the same session), and show a brief "Saved"
  confirmation state. On error: show the Supabase error message inline
  (mirror `login.tsx`'s `FieldError` pattern) — leave the draft intact on
  error so nothing is lost.

**Verification:**
- Manual smoke test against a real (or test) Supabase session: open the
  popup on an arbitrary URL, confirm URL field is preseeded; open on a
  LinkedIn job search-results URL, confirm it's cleaned to the
  `/jobs/view/:id` form; fill Company/Position/Vacancy detail, Save; confirm
  the row appears in the web app's Applications list (`draft` status,
  correct fields, HTML formatting from Quill preserved in Vacancy detail).
  Confirm Save is blocked (or shows validation) with Company/Position empty.
- Draft autosave: type into the form, close the popup without saving,
  reopen — confirm the fields (and original URL, not the current tab's)
  are restored with the "Draft restored" indicator. Click "Clear draft" —
  confirm the form resets and the draft is gone from
  `chrome.storage.local` (inspect via the extension's storage in
  DevTools). Save successfully — confirm the draft is cleared
  automatically too.
- Duplicate check: save an application for a given URL, then open the
  popup again on the same URL — confirm the "Already added on {date}"
  warning appears and Save is still clickable.
- `cd extension && npm run typecheck && npm run lint` pass.

## Phase 4 — Polish and verification

**Implement:**
- Loading/disabled states on the Save button while the insert is in flight
  (mirror `saving` pattern from `application-form-dialog.tsx`).
- `extension/README.md` (short — build/load-unpacked instructions: `cd
  extension && npm install && npm run build`, then `chrome://extensions` →
  Developer mode → Load unpacked → select `extension/dist`).
- Finish the `docs/code-map.md` entry started in Phase 1 with the actual
  files added across Phases 2–3.
- Add a `docs/progress.md` row (next index) linking spec 18 / plan 20,
  status reflecting what actually shipped.

**Verification (final phase — confirm everything above holds together):**
- Fresh `chrome://extensions` reload of `extension/dist` end to end: cold
  start (signed out) → login → add-application on a real job page → row
  confirmed in the web app → sign out → popup returns to login.
- Root `npm run typecheck && npm run lint` clean (unaffected by
  `extension/`). `extension` directory's own `npm run typecheck && npm run
  lint` clean.
- Grep check: no `host_permissions` in `manifest.json`, no `"tabs"` in
  `permissions` (only `"activeTab"`, `"storage"`), no `background` key —
  confirms the anti-pattern guards from Phase 0 held.
