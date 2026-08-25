# 18 — Chrome quick-add extension

## What

A Chrome extension (Manifest V3, popup UI) that lets the user add a new
application row to Supabase directly from whatever tab they're on — a
LinkedIn job posting, a company careers page, etc. — without switching to
the tailor-cv web app or `localhost`.

Personal-use only: one user (the repo owner), loaded as an unpacked
extension. No Chrome Web Store listing, no auto-update mechanism.

## Why

Today, logging an application means: copy the URL, switch to the tailor-cv
tab, click New Application, paste the URL, fill the form. The extension
collapses that to: click the toolbar icon on the job page itself, fill a
short form, save. The URL is preseeded from the active tab so that field
needs no typing at all.

## User flow

0. Click the toolbar icon. If there's no active Supabase session, show a
   login form (email + password, same credentials as the web app). Session
   persists across browser restarts (`chrome.storage.local`), so this is a
   rare step, not a per-use one.
1. User is on a LinkedIn job page or any job vacancy page.
2. Click the toolbar icon → popup opens with the add-application form:
   **Company, Position, Post date, URL, Vacancy detail**. URL is preseeded
   from the current tab's URL (via `cleanLinkedInJobUrl` if it's a LinkedIn
   job link, same normalization the web app's form already does on blur).
3. Click Save → inserts a row into Supabase `applications` directly from
   the extension (same Supabase project, same publishable key, same RLS —
   `auth.uid() = user_id` scopes it to the signed-in user automatically).
   Popup shows a saved confirmation, form clears, ready for the next tab.

## Fields and mapping

Maps onto the existing `applications` table / `ApplicationFormFields`
(`src/lib/application.ts`) exactly like the web app's "New Application"
dialog does, just with a reduced field set:

| Extension field | Column | Notes |
|---|---|---|
| Company | `company` | required |
| Position | `position` | required |
| Post date | `deadline` | optional, same column the web app now labels "Post date" |
| URL | `source_url` | preseeded from active tab, editable, LinkedIn-cleaned on blur |
| Vacancy detail | `vacancy_detail` | rich text — reuses `VacancyDetailEditor` (react-quill-new) from the web app source directly, not a plain textarea, so formatting/paste behavior matches |
| — | `title` | auto-derived as `"{position} at {company}"`, same fallback the web app form uses when title is left blank |
| — | `global_status` | always `"draft"` on insert, matching `createApplication` |
| — | `user_id` | from the session |

All other application fields (location, job/work type, cover letter, apply
via, persona/template linkage, note, tags) are out of scope for the
extension — those stay editable later in the web app.

## Auth

- Popup-only UI, no background service worker needed.
- Own `supabase-js` client in the extension, pointed at the same Supabase
  project via the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`
  values the web app uses (public anon key — safe to embed in the bundle,
  same as the web app already does; RLS is the actual authorization
  boundary, not the key).
- Session persisted via a `chrome.storage.local`-backed storage adapter
  passed to `createClient` (not `localStorage`, which isn't available/
  reliable across popup close/reopen in the way `chrome.storage.local` is).
- Email/password sign-in only, matching the web app's `login.tsx` — no new
  auth method invented for the extension.
- Sign-out affordance in the popup.

## Out of scope

- Scraping/auto-filling company, position, or vacancy detail from the page
  DOM (LinkedIn or otherwise). URL preseed only; everything else is manual
  entry. (Content-script scraping was considered and explicitly rejected —
  fragile against LinkedIn markup changes, not worth the upkeep for a
  personal tool.)
- Viewing, editing, or changing status of existing applications from the
  extension — add-only.
- CV/persona/template selection, cover letter, apply-via, note, tags,
  location, job/work type — all left to the web app.
- Chrome Web Store publishing, auto-update, multi-user support, other
  browsers (Firefox/Edge store variants).
- Any backend/schema/RLS changes — the extension writes through the exact
  same table and policy the web app already uses.

## Tech shape

- New top-level `extension/` folder: its own `package.json`, own Vite
  build (`@crxjs/vite-plugin` or equivalent MV3-aware Vite plugin), own
  `manifest.json`. Standalone `npm install`, doesn't touch the root app's
  build or dependencies.
- Reuses source directly from `../src/` via relative import rather than
  duplicating: `VacancyDetailEditor`, `cleanLinkedInJobUrl`
  (`lib/linkedin-job-url.ts`), and the `Database` type
  (`lib/database.types.ts`) for insert type-safety. Everything else in the
  popup (login form, add-application form, Supabase client/session
  handling) is new, extension-specific code — it doesn't need the rest of
  the app's store/context machinery (`ApplicationStoreProvider` etc.),
  just a direct `supabase.from("applications").insert(...)` call.
- Manifest permissions: `activeTab` (or `tabs`) to read the current tab's
  URL; host permission for the Supabase project URL if required by MV3's
  CSP/connect-src rules.

## Open items for the plan to resolve

- Exact MV3 build tooling choice (`@crxjs/vite-plugin` vs. alternatives)
  and whether it plays well with this repo's Vite 8 / Tailwind v4 setup.
- Popup styling: full shadcn/Tailwind reuse (shared `tailwind.config`/
  `@theme` tokens with the main app) vs. a lighter standalone setup, given
  popup real estate is small.
