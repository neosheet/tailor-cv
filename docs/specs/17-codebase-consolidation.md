# 17 — Codebase consolidation: repetition, scale, maintainability

## Why

A full-codebase audit (Aug 25, 2026) found eight concrete spots where the
codebase pays a repetition/scale/maintainability/token-efficiency cost beyond
what the existing shared infrastructure (`store-context.ts`,
`item-kind-config.ts`, `use-skills-check.ts`) already solves. None of these
are urgent bugs — this is a deliberate cleanup pass, not a feature. The goal
is to reduce the amount of code that has to be copy-pasted (and re-read by an
agent) the next time someone adds a registry, an inventory kind, a CV
override type, or a template.

## Scope (ranked by impact/effort from the audit)

1. **`requireUserId` duplicated in 5 files** — `src/lib/tags.ts`,
   `skill-categories.ts`, `inventory.ts`, `persona.ts`, `application.ts` each
   define the identical guard. Move it into `src/lib/store-context.ts` and
   import everywhere.

2. **Rename/delete dialog pattern tripled** — `src/components/settings/
   tag-dialogs.tsx`, `skill-category-dialogs.tsx`,
   `stage-template-dialogs.tsx` each hand-roll a "rename with live
   validation" `Dialog` + "delete" `AlertDialog` pair. **Scoped down after
   verification**: `stage-template-dialogs.tsx` deliberately diverges
   (documented in its own comments) — it renames name+category together, not
   name-only, has no "used on N stages" in-use copy since
   `application_stages` denormalizes rather than FK-references the template,
   and its delete is unconditional. A single rigid `RenameEntityDialog<T>` /
   `DeleteEntityDialog<T>` with a fixed prop contract would fight that. Extract
   only the genuinely identical skeleton instead — the `Dialog`/`Field`/error/
   Cancel-Submit footer wrapper (`RenameDialogShell`) and the
   `AlertDialog`/title/description/Cancel-Delete footer wrapper
   (`DeleteConfirmDialogShell`) — as thin layout components taking `children`
   for the body and title/description/submit-label as props. Each of the
   three files keeps its own validation logic, field set, and copy.

3. **Registry panel tripled** — `tags-panel.tsx`, `skill-categories-panel.tsx`,
   `stage-templates-panel.tsx` each reimplement search box, inline
   add-with-validation, hover-action table, and `useDialogSearchParams`-driven
   dialog state. Extract a generic `RegistryPanel` (config: label, columns,
   validate/create/rename/delete fns) that these three become thin config
   objects around. Depends on #2's dialogs existing first.

4. **`application.ts` JSON-patch mutators repeat a 4-step shape 6 times** —
   `setCvStyleProperty`/`resetCvStyleProperty`, `setCvPageProperty`/
   `resetCvPageProperty`, `setCvNodeOverride`/`resetCvNodeOverride` each
   look up the application, shallow-merge a patch into a
   `cvTemplateSettings.<subkey>`, and call a save wrapper. The two save
   wrappers (`saveApplicationCvPersonaSettings`,
   `saveApplicationCvTemplateSettings`) are themselves identical except for
   the column name. Collapse to one generic path-keyed JSON-patch helper.

5. ~~**`ItemKind` config split across two files**~~ — **verified false
   positive, dropped.** `item-kind-config.ts`'s `KIND_FIELDS` describes the
   inventory item form's raw DB fields (`title`, `subtitle`, `startDate`,
   `endDate`, `url`, ...). `persona.ts`'s `FIELD_REGISTRY` describes the
   resume-render visibility tree's fields — a different, derived domain
   (`dates` combines start/end, `location`/`skills` are computed,
   `responsibilities`/`highlights` are `LineKind` groups, not raw fields).
   They share a `{key, label}` shape by coincidence, not a duplicated
   concern. Left as-is.

6. **`persona-field-tree.tsx` is 1138 lines, 5 unrelated tabs in one file** —
   `VisibilityTab`, `DataTab`, `StyleTab`, `PageTab`, `BlockTab` each defined
   inline with their own row/leaf sub-components. Split into a
   `persona-field-tree/` folder, one file per tab, mirroring the
   `persona-detail.tsx` → `persona-editor-panel.tsx` extraction already done
   elsewhere in this codebase.

7. **`batch1-demo.ts` ships as a real option in the production template
   picker** — `cv-templates.ts` documents it as "a live test surface... not a
   real layout choice," yet it's listed in `cvTemplates` and shown to real
   users. Gate it out of the production picker (dev-only, e.g. behind
   `import.meta.env.DEV` or a separate dev-only registry) without deleting it.

8. ~~**`classic.ts`/`two-column.ts` duplicate block-def helpers**~~ —
   **verified intentional, dropped.** `docs/progress.md` row 20 records this
   as a deliberate architectural decision: shared blocks (`cv-template-blocks.ts`)
   were removed and inlined per-template specifically so every
   `TemplateDefinition` is fully self-contained JSON with no code dependency
   — required because exported/saved templates must serialize standalone
   (`docs/plans/06-cv-template-format.md:181`). Re-sharing would break that
   guarantee. Left as-is.

## Non-goals

- No behavior change for end users anywhere in this scope — this is
  structural only. Every item must be a no-op from the app's perspective,
  verified by `npm run typecheck` + `npm run lint` (and existing tests if
  any) after each phase.
- Not touching the two currently-uncommitted files
  (`application-detail-view.tsx`, `pool-panel.tsx`) — unrelated in-progress
  feature work.
- Not adding new registries or inventory kinds as part of this — just making
  the next one cheaper.

## Ordering constraint

#3 depends on #2 (panel extraction wants the dialog shells to exist first).
Everything else is independent. Sequenced by risk: cheapest/lowest risk first
(#1, #7), then medium (#4, #6), then the #2→#3 pair last since it's the
largest chunk. #5 and #8 are dropped (see above) — no phase for them beyond
this record.
