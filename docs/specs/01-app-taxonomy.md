# 01 — App Taxonomy

High-level structure: what sections the app has and what pages live in the Profile
section. The goal is a shared understanding of the app's shape — data models,
storage, and routing are deliberately not decided here.

## Core model

The app separates **profile** from **documents**:

- **Profile** is a set of item pools — every skill you have, every job you've held,
  every language you speak. It is not a document and is never sent to anyone.
- **A CV is a selection from those pools**, assembled for a specific role. Several CVs
  coexist, each drawing a different subset of the same profile.

This is what makes the app a *tailoring* tool rather than a document editor: you
maintain your material once, then compose per-application variants from it.

```
Profile (pools)               CVs (selections)
  skills      ─┐
  work        ─┼──────────→   "Senior Backend @ Acme"
  education   ─┤              "Frontend @ Globex"
  languages   ─┘              "Contract, short form"
```

**Selection happens at two levels.** A CV picks which entries to include, and then
which items *inside* each entry appear. One rule, applied everywhere a pool has a
nested list — bullet points in a job, keywords in a skill:

```
Profile — Backend Engineer, Acme
  • Built REST API with Node.js
  • Led a team of 4 engineers
  • Reduced database query time by 60%
  • Designed React dashboard
  • Set up CI/CD pipeline

Backend CV          →  API · query time · CI/CD
Team Lead CV        →  team of 4 · query time


Profile — skill "Backend"
  Node.js · Postgres · Redis · React · Figma

Backend CV          →  Node.js · Postgres · Redis
```

Not every pool is nested, so Profile pages come in two shapes:

| Shape | Pools | Inner list |
|---|---|---|
| **Nested** — CV picks entries *and* inner items | Work | `responsibilities`, `highlights` |
| | Volunteer | `responsibilities`, `highlights` |
| | Education | `courses` |
| | Skills | `keywords` |
| | Interests | `keywords` |
| | Projects | `highlights`, `keywords`, `roles` |
| **Flat** — CV picks whole entries only | Awards, Certificates, Publications, Languages, References | — |
| **Pick-one** — CV takes at most one row | Name, Headline, Summary, Contact, Location, Social¹ | — |

Six of seventeen pools are nested, so the nested shape is the common case among the
pools that carry real content. Projects carries three inner lists; Work and Volunteer
carry two.

¹ Social is the exception among the Basics pools — a CV can show several links, so it
behaves like a flat pool. The other five are pick-one: you have one name on a CV, one
headline, one summary, one contact set, one location.

`responsibilities` is not a `resume.json` list — it is added so a job description can
be a set of selectable items rather than one fixed paragraph. It folds back into
`summary` on export.

Text is never rewritten per CV — a bullet point reads the same wherever it appears.
Editing it in the Profile changes it everywhere.

### Snapshots

Everything above is *live*: edit the Profile and every CV updates. That stops at the
moment you apply.

When an application's status becomes **Applied**, the app freezes a snapshot of the CV
that was sent. The snapshot belongs to the application, not the CV, and is independent
of the Profile — later edits never touch it. This keeps the tracker an honest record
of what each company actually received.

```
Profile  ──live──→  CV  ──live──→  Application (before Applied)
                     │
                     └──frozen──→  Application (Applied and after)
```

## Sections

| Section | Purpose |
|---|---|
| **Dashboard** | Landing view. Pipeline at a glance — active applications, what needs attention. |
| **Profile** | The raw material. Manage item pools section by section, following the standard `resume.json` schema. |
| **CVs** | Tailored documents, each composed by selecting items from the pools. Rendered as HTML. |
| **Templates** | The print layouts a CV can be rendered with. Presentation only — a template never changes which entries or bullets appear. Each CV names its own; see [spec 03](03-cv-selection.md). |
| **Applications** | The tracker. Jobs and their status over time, from before you apply through to the outcome. Owns the sent-CV snapshot. |
| **Settings** | Account, preferences, export config. |

## Profile section — pages

One page per `resume.json` top-level key. Each page manages a **pool of items** —
add everything you've ever done here; selection happens later, at CV level.
No exceptions: Basics is a pool too.

### Core

| Page | `resume.json` key |
|---|---|
| Basics | `basics` — six pools: name, headline, summary, contact, location, social |
| Work | `work` |
| Education | `education` |
| Skills | `skills` |
| Languages | `languages` |
| Projects | `projects` |

### Additional

| Page | `resume.json` key |
|---|---|
| Volunteer | `volunteer` |
| Awards | `awards` |
| Certificates | `certificates` |
| Publications | `publications` |
| Interests | `interests` |
| References | `references` |

### Utility

| Page | Purpose |
|---|---|
| Import / Export | Import a `resume.json` — **only allowed while the Profile is empty**, so there are no merge or duplicate rules to handle. Export is always available. |

`meta` is managed automatically — not a page.

## Notes

- **Thirteen pages is heavy.** Every section except `basics` is optional and most users
  will touch five or six. The Core/Additional split is a starting guess, not a
  principled tiering — see Known weaknesses.
- **Basics is one page holding six small pools**, not one pool like the others. It stays
  a single page because six pools of two or three rows each don't deserve six pages.

## Known weaknesses

Product-level problems with this structure, unresolved:

1. **Core/Additional is arbitrary.** *Deferred — keeping the split as-is for now.* It
   encodes a software-dev bias (Projects core, Publications not) that's wrong for
   academic or early-career users. Revisit when designing the Profile shell; the
   likely fix is letting users turn on the sections they need instead of fixed tiers.
2. **Page granularity doesn't match content weight.** Languages and Interests are
   two-or-three-entry pools getting dedicated pages, while Work and Projects are
   substantial. Consider grouping the light sections together.
3. **No Profile index page.** The section has no landing view; a completeness
   overview ("Education is empty") is the conventional pattern for data entry.
4. **Projects has three inner lists** (`highlights`, `keywords`, `roles`). The
   universal rule says a CV picks from each of them, but three separate selection
   controls on one entry may be too much. Check this when designing the CV builder.

## Resolved

- **One resume or several** → Profile is a single set of pools; *several CVs* are
  built from it. Profile pages need no "which resume am I editing" context.
- **Is a CV a subset or a copy** → a subset. CVs select from the pools.
- **Section and entry ordering** → belongs to the CV, since that's where composition
  happens. The profile has no meaningful display order.
- **Naming** → the inventory section is "Profile", not "Resume". CV is the only word
  used for a finished document, so the two never read as synonyms.
- **Tailoring granularity** → two levels: pick entries, then pick bullet points within
  each entry. The CV builder is a selection UI, not a plain checklist.
- **Per-CV wording overrides** → no. A bullet point reads the same on every CV. This
  keeps the Profile the single source of truth for all text.
- **Sent CVs** → snapshotted when status becomes Applied. The snapshot lives on the
  application and is independent of Profile and CV edits.
- **Jobs before applying** → tracked in Applications as an earlier status, not a
  separate section. Applied is one point in a status lifecycle, not the starting point.
- **Public CVs** → no. Everything stays behind login; no public links, no
  unauthenticated routes.
- **Nested selection is universal** → wherever a pool has an inner list, a CV picks
  from it: bullet points in a job, keywords in a skill. One rule, no exceptions.
- **Deleting a Profile item** → warn first, showing which CVs use it. On confirm it
  disappears from all of them — but the delete is **soft and reversible**: the entry
  goes to Trash and can be restored to every CV that still selects it. Snapshots are
  frozen and never affected. See Soft delete in spec 02.
- **Import** → allowed only into an empty Profile. No merge, no duplicate handling.
- **Is Basics a pool** → yes. An earlier draft made it the one exception — a single
  identity record appearing on every CV unchanged. That was wrong: a headline and a
  summary are precisely what you want variants of per role, and the same holds for
  contact sets, locations, and which social links to show. Basics is six small pools
  (name, headline, summary, contact, location, social), five of them pick-one.

## Open questions

None blocking. Two follow-ups worth settling when Applications is specced:

1. **What are the statuses**, and which one is the starting point?
2. **Can there be more than one snapshot per application** — if you send a revised CV
   later, is that a second snapshot or a replacement?

And one raised by soft delete:

3. **Where does Trash live?** Deletes are now reversible, so restoring needs a surface.
   A page under Profile → Utility is the obvious home, which would make it a
   fourteenth page. The alternative is per-pool — a "show deleted" toggle on each
   Profile page — which adds no page but scatters the restore path. Undecided; the
   schema supports either.
