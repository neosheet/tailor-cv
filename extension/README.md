# tailor-cv quick add (Chrome extension)

MV3 popup extension for quick-adding an application row to Supabase from
whatever tab you're on. Personal-use, unpacked-only — see
`docs/specs/18-chrome-quick-add-extension.md` and
`docs/plans/20-chrome-quick-add-extension.md` in the root repo for the full
spec/plan.

## Setup

Before building, add `extension/.env.local` with the same Supabase values the
root app's `.env.local` already has:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Copy the values straight from the root app's `.env.local` — same Supabase
project, same publishable key. This file is gitignored (root's `.gitignore`
has an unanchored `*.local` pattern), so it isn't committed.

## Build

```
cd extension
npm install
npm run build
```

This produces `extension/dist/`.

## Load into Chrome

1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension/dist` folder.
4. Click the toolbar icon to open the popup — sign in with your tailor-cv
   credentials.

Rebuilding (`npm run build`) updates `dist/`; reload the extension from
`chrome://extensions` to pick up the change.
