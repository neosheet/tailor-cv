# tailor-cv

## Stack

- **Frontend**: React + Vite (SPA, not Next.js — no App Router, no RSC, no server actions)
- **UI**: shadcn/ui
- **Hosting**: Vercel
- **Database**: Supabase (Postgres, Auth, Storage, etc. as needed)

## Workflow

Every non-trivial change follows plan → execute, never straight to code. Working
documents live in `docs/` (see `docs/README.md`):

1. **Spec first** for anything non-trivial: write `docs/specs/NN-name.md` — the
   what/why, not a task breakdown.
2. **Plan.** Use `/make-plan` for multi-phase or multi-file features — it writes a
   persisted, phased plan to `docs/plans/NN-name.md` (doc discovery included, linked
   back to the spec). Use native plan mode (`EnterPlanMode`) instead for smaller,
   single-session changes that don't need a saved artifact. Use judgment on which
   fits; when in doubt, ask.
3. **Optionally stress-test the plan** with the `grill-me` skill (`/grilling`) before
   execution on anything architecturally risky or ambiguous — it's a manual trigger,
   invoke it explicitly, don't wait for it to fire on its own.
4. **Execute** with `/do` for plans produced by `/make-plan`, checking off phases in
   `docs/progress.md` as they complete — keep that file in sync with reality, don't
   let it drift.
5. **Commit as soon as a task (or plan phase) is complete.** No need to ask first —
   this is standing authorization to commit at each completion point. Still follow
   the repo's normal commit hygiene (stage relevant files only, no `--no-verify`,
   never force-push or amend). Push remains something to ask about separately.

Don't ask for confirmation before invoking skills below — they're expected to fire
automatically based on the task at hand.

## Code map

`docs/code-map.md` is a table-of-contents index of important files by domain
(routing, layout, inventory, persona/CV, applications, settings, data/backend).
**Check it first when exploring the codebase or locating where a feature
lives** — it's cheaper than scanning/grepping the tree. **Keep it in sync:**
whenever you add, remove, rename, or meaningfully repurpose a file it lists,
update `docs/code-map.md` in the same change.

## Skills (`.claude/skills/`)

Installed via `npx skills add/use <repo> --skill <name>`, then copied out of the
symlink into a plain directory here so every skill is stored the same way (no mixed
symlink/real-file layout).

| Skill | Use for |
|---|---|
| `shadcn` | Adding/searching/fixing shadcn components, presets, `components.json` work |
| `vite` | Vite config, build, dev-server conventions |
| `supabase` | Any Supabase task: client setup, auth, RLS, migrations, storage, edge functions |
| `supabase-postgres-best-practices` | Schema design, indexing, query/migration quality |
| `vercel-react-best-practices` | React perf patterns. **Some rules are Next.js-specific (server actions, API routes, RSC caching) and don't apply here** — apply judgment for what's relevant to a Vite SPA vs. skip |
| `grill-me` | Manual only — adversarial review of a plan before execution |

## Conventions

- **Always use shadcn/ui for UI components. Never hand-build a component from scratch
  unless the element genuinely isn't available in shadcn.** Before writing custom
  markup: check installed components (`resolvedPaths.ui`), then `npx shadcn@latest
  search` across configured registries (including community registries), then `npx
  shadcn@latest view` to inspect anything not yet installed. Only fall back to custom
  markup once all of that comes up empty — and prefer composing existing primitives
  (e.g. Tabs + Card, Sidebar + Table) over a new one-off component even then.
- Use semantic Tailwind tokens (`bg-primary`, `text-muted-foreground`), not raw colors — enforced by the shadcn skill's styling rules.
- **Tailwind v4 only.** Style with utility classes (`@theme inline` for custom tokens, per the shadcn skill's `tailwindVersion` field) — never inline `style={{}}` props and never hand-edit `.css` files directly (the one exception is the generated global CSS file itself for defining/adjusting `@theme` tokens, per `tailwindCssFile`).
- **Extract repeated styling into a reusable component**, not copy-pasted className strings. If the same utility combination shows up more than once, pull it into a small component (or compose existing shadcn primitives) rather than repeating it inline.
- **If you have to write the same component twice, extract it into a reusable component.** Applies to more than styling — form fields, dialogs, list rows, anything with matching structure/behavior. The second occurrence is the signal to extract, not the third.
- Non-shadcn dependencies: use whatever package manager `package.json` declares (npm — see `packageManager`/lockfile).
- Supabase changes frequently; the supabase skill will verify against current docs rather than relying on training data — let it.

## Verifying UI work
**Skip the visual check by default — don't screenshot or browse the app unless the
user explicitly asks for it.**

- Always run `npm run typecheck` and `npm run lint` before calling work done — those
  are cheap and catch the real problems, and are required regardless of visual
  checking.
- Do a visual check (one desktop screenshot of the changed page plus a console-error
  check) only when the user asks for it, or when the change is specifically about
  visual/responsive/theming behavior where a check is the only way to confirm it.
- When a visual check does happen: don't check mobile/narrow viewports or dark mode
  unless asked — no resizing the viewport, no toggling themes, no screenshots of
  either. Semantic tokens and responsive utilities are assumed to handle both; fix it
  when it's actually reported broken.
