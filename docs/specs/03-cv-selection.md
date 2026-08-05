# 03 — CV Selection

How a CV is stored: which entries and bullets it draws from the Inventory, in what order,
and why the template that lays it out is deliberately not stored here.

Builds directly on [02 — Inventory Data Model](02-inventory-data-model.md), which sketched
these tables under "How CV selection will use this" and deferred them. This spec is that
promise kept — the sketch was right, and it is settled here with the conventions the rest
of the schema has since acquired.

## The idea, restated

Spec 01 defines a CV as **a selection from the pools**, not a copy of them. That single
sentence is the whole data model:

```
inventory_items ──┐
                  ├──→ cv_items ──→ one CV
inventory_lines ──┘     cv_lines
```

A CV owns no text. Editing a bullet in the Inventory changes it on every CV that selected
it, which is exactly what spec 01 promised and what makes the app a tailoring tool rather
than four copies of a document drifting apart.

## Tables

Four, following the conventions already set in spec 02: `note`, `deleted_at`, and
`created_at` / `updated_at` on anything that holds user content.

### `cvs`

One row per tailored document.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | what applications point at |
| `user_id` | `uuid` FK → `profiles(id)` | `ON DELETE CASCADE` |
| `name` | `text` | "Senior Backend — Nusantara". Yours, never rendered on the CV |
| `note` | `text` | private annotation, as everywhere else |
| `deleted_at` | `timestamptz` | null means live — soft delete, per spec 02 |
| `created_at` / `updated_at` | `timestamptz` | |

**A CV stores no template.** See Template binding.

### `cv_sections`

Which pools appear on this CV, and in what order. A CV that omits a section simply has no
row for it.

| Column | Type | Notes |
|---|---|---|
| `cv_id` | `uuid` FK → `cvs(id)` | `ON DELETE CASCADE` |
| `kind` | `item_kind` | the pool this section renders |
| `position` | `int` | section order within the document |

Primary key `(cv_id, kind)` — a pool appears at most once per CV.

This is what lets one CV put Skills above Work and another put it below, from the same
rows. Without it, section order would be a property of the app and identical everywhere.

### `cv_items`

One row per selected entry.

| Column | Type | Notes |
|---|---|---|
| `cv_id` | `uuid` FK → `cvs(id)` | `ON DELETE CASCADE` |
| `item_id` | `uuid` FK → `inventory_items(id)` | `ON DELETE CASCADE` |
| `position` | `int` | order **within its section**, not the document |

Primary key `(cv_id, item_id)`.

`position` being section-scoped matters and is easy to misread — an entry's section comes
from its `kind`, so ordering never crosses a section boundary. Spec 02 flagged this in its
open points; it is settled here.

### `cv_lines`

One row per selected bullet, keyword, course, or role.

```sql
create table cv_lines (
  cv_id   uuid not null,
  item_id uuid not null,
  line_id uuid not null references inventory_lines(id) on delete cascade,
  position int not null default 0,
  primary key (cv_id, line_id),
  foreign key (cv_id, item_id)
    references cv_items (cv_id, item_id) on delete cascade
);
```

**A selected line must have its entry selected too.** Routing the foreign key through
`cv_items` rather than pointing at `inventory_lines` alone is what enforces that: a bullet
cannot be written without its parent entry already selected, and deselecting an entry
removes its bullets automatically. Carrying `item_id` is redundant data bought deliberately
for that guarantee.

One gap the foreign keys cannot close: nothing stops `line_id` belonging to a *different*
item than `item_id`. That needs a trigger.

```sql
create or replace function cv_line_belongs_to_item() returns trigger as $$
begin
  if not exists (
    select 1 from inventory_lines
     where id = new.line_id and item_id = new.item_id
  ) then
    raise exception 'cv_lines: line % does not belong to item %',
      new.line_id, new.item_id;
  end if;
  return new;
end $$ language plpgsql;

create trigger check_parent before insert or update on cv_lines
  for each row execute function cv_line_belongs_to_item();
```

## Ordering lives at all three levels

Sections, entries, and lines each carry `position`. That is what scenario 4 in spec 02
needs: two CVs can order the same skills differently, order the same job's bullets
differently, and place the sections themselves differently, while sharing every underlying
row.

`position` on `cv_lines` is the one that is easy to leave out and the one that matters
most — without it, bullet order is fixed by the Inventory, and the lead bullet of a job
could not differ between a backend CV and a leadership CV.

Same rule as spec 02: `position` is not unique, so **every ordered query needs a
tiebreaker** — `order by position, created_at, id`.

## Template binding

**A CV does not own a template.** Nothing here stores one.

An earlier draft of this spec put `template_id` on `cvs`, reasoning that how a CV looks is
part of tailoring it. That was a level too high. A CV is *content* — which entries, which
bullets, in which order. A template is how that content is laid out on a page, and the same
content can legitimately go out under different layouts to different employers.

So the layout is a **preview choice** wherever a CV is displayed: pick a CV, pick a
template, see the result. Neither choice is persisted, and switching either one is free.

**The binding that does matter lives on the application.** What you actually need to know
later is "which layout did Globex receive?" — and that is a fact about a submission, not
about the CV, which may since have been re-rendered a dozen other ways. It belongs
alongside the frozen CV snapshot spec 01 describes, and is settled when Applications is
specced.

This supersedes the open item recorded in `docs/progress.md` row 04, which asked whether
binding was per-CV, global, or per-print. The answer is none of those: per-application.

## Soft delete and empty sections

A CV holding a soft-deleted entry keeps its `cv_items` row. The entry renders as absent
because reads go through `live_items` (spec 02), and restoring it returns it to every CV
that still selects it.

The consequence to handle in the renderer: **a section can be non-empty in `cv_sections`
and empty once filtered.** A CV whose only two projects are both in Trash still has a
Projects section row. Templates must omit a section with no surviving entries rather than
printing a bare heading.

## What a template receives

Templates never read these tables. One builder resolves a CV into a flat, ordered
`ResumeDocument` — sections already ordered, entries already filtered to the selected and
live rows, lines already narrowed — and templates render that.

That seam is the reason templates need no changes when the mock data is swapped for
Supabase: the query layer moves, the document shape does not.

## Row-level security

All four tables carry RLS. `cvs` owns a `user_id` and takes the direct policy; the other
three are reached through their parent, the same shape spec 02 uses for `inventory_lines`:

```sql
create policy "own rows" on cvs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sections" on cv_sections
  for all using (
    exists (select 1 from cvs c where c.id = cv_sections.cv_id
              and c.user_id = auth.uid())
  ) with check (
    exists (select 1 from cvs c where c.id = cv_sections.cv_id
              and c.user_id = auth.uid())
  );
```

`cv_items` and `cv_lines` take the same shape against `cvs`.

## Indexes

| Index | Reason |
|---|---|
| `cvs (user_id) where deleted_at is null` | the CVs list |
| `cv_sections (cv_id, position)` | assembling a document |
| `cv_items (cv_id, position)` | the entries of a CV |
| `cv_items (item_id)` | reverse lookup — which CVs use this entry |
| `cv_lines (cv_id, item_id, position)` | the bullets of one entry |
| `cv_lines (line_id)` | reverse lookup for the delete warning |

The two reverse-lookup indexes are what make spec 01's "warn before deleting, showing which
CVs use it" cheap. Without them that query scans every selection row the user owns.

## Open points

1. **Snapshots are still undesigned.** Spec 01 says a snapshot freezes when an application
   becomes Applied. Being frozen copies rather than references, nothing here constrains
   them — but "copy of what, exactly" is unanswered. The natural answer is a rendered
   `ResumeDocument` stored as `jsonb`, which survives any later Inventory edit. Settle it
   when Applications is specced.
2. **No per-CV wording overrides**, per spec 01. If that ever changes, an override column on
   `cv_lines` is where it goes — and the Inventory stops being the single source of truth
   for text, which is why spec 01 rejected it.
3. **Section kinds are `item_kind` values**, so the six Basics pools are sections too. A
   template almost certainly renders those as the header block rather than as sections;
   whether `cv_sections` should exclude them, or the template should special-case them, is
   a renderer question left to the template work.
4. **Nothing enforces one row per pick-one Basics pool.** Spec 01 says a CV takes at most
   one name, headline, summary, contact, and location. The primary key permits two. A
   partial unique index on `(cv_id)` per pick-one kind would enforce it; deferred until the
   CV builder exists to violate it.
