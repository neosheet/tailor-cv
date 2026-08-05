# 02 — Inventory Data Model

Supabase (Postgres) table design for the Inventory section. Depends on
[01 — App Taxonomy](01-app-taxonomy.md) and the scenarios in
[user-problem.md](../user-problem.md).

Diagram: [02-inventory-schema-diagram.md](02-inventory-schema-diagram.md)

> **`resume.json` is an influence, not a constraint.** It gave the model its shape and
> remains the export target, but the product comes first. Where a scenario needs
> something the schema lacks — selectable responsibilities, tags, skill links, years of
> experience — the model adds it and export does the best it can.

---

## Scenario coverage

The six scenarios from [user-problem.md](../user-problem.md), and what carries each.

| # | Scenario | Covered by |
|---|---|---|
| 1 | Multiple CVs, all content chosen from the Inventory | `cvs` + `cv_items` + `cv_lines` |
| 2 | Choose which job details go on each CV | `inventory_lines` with `responsibilities` / `highlights`, selected per CV |
| 3 | Tag a work entry with skills taken from the Skills pool | **`item_skills`** — a real link, not free text |
| 4 | Reorder anything, differently per CV | `position` on `cv_sections`, `cv_items`, **and `cv_lines`** |
| 5 | See which CVs use an Inventory item | reverse query over `cv_items` / `cv_lines` |
| 6 | Show years of experience on a skill | **`inventory_items.years_experience`** |

Items in bold were added after reviewing these scenarios; the rest already worked.

---

## The decision that shapes everything

CVs select **individual bullet points and keywords**, not just whole entries. That
single requirement rules out the obvious design.

If a job's bullet points are stored as a JSON array on the job row, a CV cannot point
at bullet number three in a stable way — reorder the list or fix a typo and the
reference breaks. **Every nested item needs its own row and its own id.**

That forces a second question: how many tables?

| Approach | Tables | Trade-off |
|---|---|---|
| **Normalized per kind** — `work_entries`, `work_highlights`, `education_entries`, `education_courses`, … | ~30 | Real foreign keys, `ON DELETE CASCADE` for free, type-safe columns. But 11 entry tables × 11 CV-selection join tables is a lot of surface for a personal app, and 8 of the child tables are byte-for-byte identical. |
| **Unified** — one item table, one line table | 4 | CV selection becomes a single table with one foreign key. Adding a new `resume.json` section is data, not a migration. Costs some column-level type safety. |

**Chosen: unified.** The whole product is "select arbitrary things into a document," so
the selection layer is the part that must stay simple. Thirty tables to support it is
the wrong trade.

> Reversible, but not cheaply — once CVs and snapshots reference item ids, changing
> this means migrating real data. Worth disagreeing now if you disagree.

A useful accident: `references` is a reserved word in Postgres. The unified model
never needs a table by that name.

---

## Tables

### `profiles`

One row per user. **Account anchor only** — it holds no CV content.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | `references auth.users(id) on delete cascade` |
| `created_at` / `updated_at` | `timestamptz` | |

Every other table's `user_id` points here, and the RLS policies key off it, so this row
must exist even though it carries nothing of its own.

> **Basics is a pool, not a record.** An earlier draft kept `name`, `label`, `email`,
> `summary`, and the flattened `location_*` columns on this table, on the reasoning that
> identity appears on every CV unchanged. That was wrong for this product: a headline and
> a summary are exactly the things you want several of and pick between per role, and the
> same applies to contact sets and locations. Those columns moved into `inventory_items`
> as their own kinds. The table stays because dropping it would break every foreign key
> and policy in this spec.

`social_profiles` is gone for the same reason — GitHub belongs on an engineering CV and
nowhere else, which makes it a selection, not a fixed field. It is now the `social` kind
in `inventory_items`.

### `inventory_items`

Every entry from every pool. One table, distinguished by `kind`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | what CVs point at |
| `user_id` | `uuid` FK → `profiles(id)` | `ON DELETE CASCADE` |
| `kind` | `item_kind` enum | see mapping below |
| `title` | `text` | the primary label |
| `subtitle` | `text` | the secondary label |
| `summary` | `text` | free text |
| `url` | `text` | |
| `start_date` | `text` | **not `date`** — see Dates |
| `end_date` | `text` | null for single-date and ongoing items |
| `details` | `jsonb` | kind-specific leftovers, default `{}` |
| `years_experience` | `numeric(4,1)` | skills only — `5`, `2.5`. Constrained, see below |
| `tags` | `text[]` | free-form labels for filtering, default `{}` — see Tags |
| `note` | `text` | private annotation — see Notes. Never exported, never rendered on a CV |
| `favorite` | `boolean` | `not null default false` — see Favourites |
| `position` | `int` | display order within its pool |
| `deleted_at` | `timestamptz` | null means live — see Soft delete |
| `created_at` / `updated_at` | `timestamptz` | |

```sql
create type item_kind as enum (
  -- basics pools
  'name', 'headline', 'summary', 'contact', 'location', 'social',
  -- everything else
  'work', 'volunteer', 'education', 'award', 'certificate',
  'publication', 'skill', 'language', 'interest', 'reference', 'project'
);
```

The first six are the Basics pools. They behave like every other pool — several rows,
and a CV picks which ones it uses — but with one rule the others don't have: **a CV
takes at most one row from each.** You have one name on a CV, one headline, one
summary. That is a constraint on the selection layer, not on this table.

Constraints on the table:

```sql
-- years_experience belongs to skills, and time does not run backwards
check (years_experience is null
       or (kind = 'skill' and years_experience >= 0)),

-- partial ISO dates only: 2014 | 2014-06 | 2014-06-29
check (start_date is null or start_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
check (end_date   is null or end_date   ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),

-- an entry cannot end before it starts (ISO text compares chronologically)
check (start_date is null or end_date is null or end_date >= start_date)
```

Without the first check, `years_experience` could be set on a `language` or `award`
row, or go negative.

### `inventory_lines`

Every nested string. This table exists because **every nested list is an array of plain
strings** — `highlights`, `courses`, `keywords`, and `roles` come from `resume.json`,
`responsibilities` is ours, and all five are the same shape, so they share one table.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | what CVs point at for bullet-level selection |
| `item_id` | `uuid` FK → `inventory_items(id)` | `ON DELETE CASCADE` |
| `list_kind` | `line_kind` enum | `highlights` \| `responsibilities` \| `courses` \| `keywords` \| `roles` |
| `content` | `text` | the bullet point or keyword itself |
| `tags` | `text[]` | free-form labels for filtering, default `{}` — see Tags |
| `note` | `text` | private annotation — see Notes. Never exported, never rendered on a CV |
| `position` | `int` | order within its list |
| `deleted_at` | `timestamptz` | null means live — see Soft delete |
| `created_at` / `updated_at` | `timestamptz` | |

```sql
create type line_kind as enum (
  'highlights', 'responsibilities', 'courses', 'keywords', 'roles'
);
```

`list_kind` is what lets one item carry several independent lists — Projects has three,
and Work has two.

**`responsibilities` is ours, not `resume.json`'s.** It exists so a job description can
be a list of selectable, taggable items instead of one opaque paragraph. Work and
Volunteer are the kinds that use it — both describe a role held. See Summary and
responsibilities for how it survives export.

### `item_skills`

Links an entry to skills **taken from the Skills pool** — scenario 3. Tagging the Acme
job with `Node.js` and `Postgres` points at the real skill rows, so renaming a skill
once updates it everywhere and you can ask "which jobs used Postgres?".

| Column | Type | Notes |
|---|---|---|
| `item_id` | `uuid` FK → `inventory_items(id)` | the work / project / volunteer entry |
| `skill_id` | `uuid` FK → `inventory_items(id)` | must be an item with `kind = 'skill'` |
| `position` | `int` | display order |

Primary key is `(item_id, skill_id)`. Both sides cascade on delete.

This is a self-referencing many-to-many on `inventory_items`. A plain foreign key cannot
express "must be a skill", but a composite key can — the target's `kind` is pinned by a
constant column:

```sql
alter table inventory_items add constraint uq_item_kind unique (id, kind);

create table item_skills (
  item_id  uuid not null references inventory_items(id) on delete cascade,
  skill_id uuid not null,
  skill_kind item_kind not null default 'skill' check (skill_kind = 'skill'),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, skill_id),
  check (item_id <> skill_id),
  foreign key (skill_id, skill_kind)
    references inventory_items(id, kind) on delete cascade
);

create index on item_skills (skill_id);
```

`skill_kind` is a real column with a default and a CHECK, **not** a generated column.
A `generated always as ('skill') stored` column would be tidier, but the Postgres
documentation neither permits nor forbids constant generation expressions, and a schema
should not rest on undocumented behaviour.

The `check (item_id <> skill_id)` stops a skill linking to itself. The index on
`skill_id` is what makes the reverse lookup — "which jobs used Postgres?" — cheap;
without it the primary key only serves lookups that start from `item_id`.

**Skill links are not tags.** They look similar and do different jobs:

| | `tags` | `item_skills` |
|---|---|---|
| Value | any text you type | a row in the Skills pool |
| Purpose | filter while building a CV | record which skills a role actually used |
| Rename | update every row | change one row, done |
| On a CV | never rendered | rendered, if the template shows it |

### `tags`

The registry every tagged row draws from — the canonical list of a user's tags.
See Tags for why it exists and how the two content tables stay consistent with it.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` FK → `profiles(id)` | `ON DELETE CASCADE` |
| `name` | `text` | lower-case alphanumeric, unique per user |
| `created_at` / `updated_at` | `timestamptz` | |

```sql
create table tags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  check (name ~ '^[a-z0-9]+$')
);
```

The CHECK is the normalisation rule made structural: `Backend`, `back end`, and
`back-end` cannot reach the table at all, so `backend` stays the only spelling.
Case-folding and trimming happen on write, before the insert.

**No `deleted_at`.** Soft delete protects content — an entry or a bullet you might
want back. A tag is metadata about content, it holds nothing you would mourn, and a
deleted one is re-creatable by typing five characters. Deletion is immediate; the
confirm dialog, which states how many rows the tag is on, is the safety net. This is
a deliberate exclusion, not an oversight — see Soft delete.

---

## Field mapping

How each `resume.json` section maps onto `inventory_items`. This table is the
contract — import, export, and the UI all depend on it.

| `kind` | `title` | `subtitle` | `summary` | `start_date` | `end_date` | `details` keys | lines |
|---|---|---|---|---|---|---|---|
| `name` | `basics.name` | — | — | — | — | — | — |
| `headline` | `basics.label` | — | — | — | — | — | — |
| `summary` | short label, ours | — | `basics.summary` | — | — | — | — |
| `contact` | short label, ours | `basics.email` | — | — | — | `phone`, `image` | — |
| `location` | `city` | `region` | — | — | — | `address`, `postalCode`, `countryCode` | — |
| `social` | `network` | `username` | — | — | — | — | — |
| `work` | `name` (company) | `position` | `summary` | `startDate` | `endDate` | `employmentType`, `workplaceType`, `location` | `responsibilities`, `highlights` |
| `volunteer` | `organization` | `position` | `summary` | `startDate` | `endDate` | — | `responsibilities`, `highlights` |
| `education` | `institution` | `area` | — | `startDate` | `endDate` | `studyType`, `score` | `courses` |
| `skill` | `name` | `level` | — | — | — | — | `keywords` |
| `interest` | `name` | — | — | — | — | — | `keywords` |
| `project` | `name` | — | `description` | `startDate` | `endDate` | `entity`, `type` | `highlights`, `keywords`, `roles` |
| `award` | `title` | `awarder` | `summary` | `date` | — | — | — |
| `certificate` | `name` | `issuer` | — | `date` | — | — | — |
| `publication` | `name` | `publisher` | `summary` | `releaseDate` | — | — | — |
| `language` | `language` | `fluency` | — | — | — | — | — |
| `reference` | `name` | — | `reference` | — | — | — | — |

Single-date kinds (`award`, `certificate`, `publication`) use `start_date` and leave
`end_date` null, rather than hiding the date in `details`.

The `url` column carries `basics.url` on `contact` and the profile link on `social`;
the Basics kinds never use `start_date` or `end_date`.

**Why `title` on `summary` and `contact` is ours, not `resume.json`'s.** A pool needs
something to pick *by*. Three summaries all rendering as a wall of prose are unpickable,
so each carries a short label — "Backend-leaning", "Leadership-leaning" — that names the
variant in the CV builder and is never exported.

### Work engagement fields

Three keys on `work.details` describe the shape of the engagement rather than the job:

| Key | Values | Meaning |
|---|---|---|
| `employmentType` | `full-time` · `part-time` · `contract` · `freelance` · `internship` | the basis you were engaged on |
| `workplaceType` | `remote` · `hybrid` · `on-site` | where the work happened |
| `location` | free text — `"Jakarta, ID"` | the role's location, city and country |

All three are optional; older entries often will not have them.

**On the names.** `status` and `type` were the obvious words and both are wrong here.
`kind` already means "which pool" on this table, so a second `type` reads as a synonym of
it; and `status` elsewhere in this app means where an application sits in its lifecycle.
`employmentType` and `workplaceType` say which axis they describe, and match the
vocabulary LinkedIn and schema.org already use, which is what users will expect.

`location` is a plain string, not a reference to the `location` pool. A job's location is
a fact about that job — it does not change per CV, and you do not pick between two of
them — so it is a field, not a pool. The Basics `location` pool is a different thing: it
is where *you* are, and a CV picks one.

**These are display values, not enums.** Like everything in `details`, nothing in the
database constrains them — the application owns the vocabulary. A `check` constraint per
key is possible (`kind <> 'work' or details->>'workplaceType' in (...)`) and worth adding
if these ever drive filtering rather than just rendering. See Open points.

Columns outside `resume.json` are not in the table above because they belong to no
section — `tags` on both item and line, `years_experience` on `skill`, and the
`item_skills` link from `work` / `project` / `volunteer`.

---

## Summary and responsibilities

A Work entry describes the role in two ways, and they are stored differently for a
reason:

| | Storage | Selectable per CV? | Taggable? |
|---|---|---|---|
| **Summary** — a paragraph | `inventory_items.summary` | No, all-or-nothing | No |
| **Responsibilities** — a list | `inventory_lines`, `list_kind='responsibilities'` | Yes | Yes |
| **Highlights** — achievements | `inventory_lines`, `list_kind='highlights'` | Yes | Yes |

Use whichever suits the entry. A paragraph for a role that needs prose, a list for one
that reads better as bullets, or both.

### Export collision

`resume.json` has only one field for all of this: `work.summary`, a plain string. So
export must combine two sources into one. The rule:

```
work.summary  =  summary paragraph
                 + blank line (if both present)
                 + responsibilities as a markdown list
```

```json
{
  "summary": "Owned the payments platform end to end.\n\n- Owned payments API\n- Ran on-call rotation\n- Reviewed code"
}
```

Deterministic, and the output stays valid `resume.json` because a markdown list is
still a string.

**Round-trip is lossy.** On import, a markdown list inside `summary` lands in the
`summary` column as plain text — it is not split back into responsibility lines. Import
only runs into an empty Inventory and usually comes from other tools, so this is
accepted rather than solved. Splitting on import can be added later if it ever matters.

---

## Tags

Both selectable levels carry `tags` — entries and lines. Anything a CV can include can
be labelled.

They exist to make building a tailored CV fast. A job held for four years accumulates
bullet points that would never sensibly appear together; tagging them `backend`,
`leadership`, or `frontend` turns "find the relevant material" into a filter instead of
a re-read.

```
inventory_items   id=a1  "Acme / Backend Engineer"   tags={employment}

inventory_lines   b1  "Built REST API with Node.js"        tags={backend, api}
                  b2  "Led a team of 4 engineers"          tags={leadership}
                  b3  "Reduced query time by 60%"          tags={backend, performance}
                  b4  "Designed React dashboard"           tags={frontend}
                  b5  "Set up CI/CD pipeline"              tags={backend, devops}

Filter by `backend`  →  b1, b3, b5
Filter by `leadership` →  b2
```

**Storage is a hybrid: a registry table plus `text[]` columns.**

`tags` holds the canonical list — one row per tag per user. The `tags` column on
`inventory_items` and `inventory_lines` holds names **drawn from that list**, and stays
a `text[]` rather than a join table because that is what makes filtering cheap: Postgres
indexes arrays natively and containment queries are direct (`tags @> '{backend}'`).

The registry earns its place by making a tag exist independently of anything using it.
Without it there is no list to autocomplete from, no way to create a tag before the
first row is labelled, and no name to rename or delete — a derived
`select distinct unnest(tags)` list can only ever describe what already happened.

```
tags              backend  leadership  frontend  performance  api  devops
                     ↑ the vocabulary — this is what a tag picker offers

inventory_items   a1  tags={employment}        ┐ names, all drawn
inventory_lines   b1  tags={backend, api}      ┘ from the registry
```

**Postgres cannot foreign-key an array element**, so the "drawn from the registry" rule
is not an FK and must not be written as one. Two things hold it:

1. Every row write only ever carries registry names. A tag picker may let someone type a
   name no suggestion matches, but that path registers it (adds the row to `tags`) before
   applying it — it never writes an unregistered name onto a row.
2. A trigger on insert and update of both content tables rejects anything unregistered,
   so a direct SQL write cannot drift:

```sql
create function assert_tags_registered() returns trigger as $$
declare owner_id uuid;
begin
  if new.tags = '{}' then return new; end if;

  -- inventory_lines has no user_id; reach it through the parent item
  owner_id := coalesce(
    new.user_id,
    (select i.user_id from inventory_items i where i.id = new.item_id)
  );

  if exists (
    select 1 from unnest(new.tags) as t(name)
     where not exists (
       select 1 from tags
        where tags.user_id = owner_id and tags.name = t.name)
  ) then
    raise exception 'tags must exist in the tag registry';
  end if;

  return new;
end;
$$ language plpgsql;
```

`new.user_id` resolves on `inventory_items` and is unknown on `inventory_lines`, so the
function is written once and attached to both tables; the `coalesce` picks whichever
side applies.

**The three writes.** Rename and delete each touch the registry and both content tables,
so both run in one transaction — a half-applied rename leaves rows carrying a name no
longer in the registry, which the trigger would then reject on their next update.

```sql
-- create
insert into tags (user_id, name) values (auth.uid(), 'backend');

-- rename: backend → serverside
update tags set name = 'serverside'
 where user_id = auth.uid() and name = 'backend';
update inventory_items set tags = array_replace(tags, 'backend', 'serverside')
 where user_id = auth.uid() and tags @> '{backend}';
update inventory_lines set tags = array_replace(tags, 'backend', 'serverside')
 where tags @> '{backend}';

-- delete: strip it from every row that carries it, then drop the row
update inventory_items set tags = array_remove(tags, 'backend')
 where user_id = auth.uid() and tags @> '{backend}';
update inventory_lines set tags = array_remove(tags, 'backend')
 where tags @> '{backend}';
delete from tags where user_id = auth.uid() and name = 'backend';
```

Deleting a tag that is in use is allowed on purpose — cleaning up a vocabulary is the
common case, and requiring every row to be untagged first would make it tedious enough
that nobody would. The UI states the usage count before it happens.

Usage counts, which the management screen shows and a derived list could never give
cheaply for unused tags, come from the two GIN indexes:

```sql
select (select count(*) from inventory_items where tags @> array[t.name]) as items,
       (select count(*) from inventory_lines where tags @> array[t.name]) as lines
  from tags t where t.user_id = auth.uid();
```

**Tags are ours, not `resume.json`'s.** The schema has no `tags` field, so export must
drop them or the output stops being valid `resume.json`. They are a build-time tool,
not résumé content.

---

## Notes

Both selectable levels also carry `note` — a single free-text field for whatever you
need to remember about a row.

Tags and notes look similar and do opposite jobs. A tag is structured, shared across
rows, and exists to be queried. A note is unstructured, belongs to exactly one row, and
exists to be read by you:

| | `tags` | `note` |
|---|---|---|
| Shape | `text[]`, normalised | free text |
| Shared across rows | yes | no |
| Queried | yes — `tags @> '{backend}'` | no |
| Purpose | filter material while building | remember something about this row |

What it is actually for — the cases that motivated it:

```
"Manager disputes the 60% figure. Verify before using."
"Only mention at companies that already use Kubernetes."
"Wording came straight from the Globex job ad — reword if reusing."
"Superseded by the Lumbung role. Keep for the 2019 gap."
```

**Never leaves the app.** `note` is not in `resume.json`, is dropped on export, and is
never rendered on a CV or into a snapshot. A note saying "manager disputes this figure"
appearing on a sent CV would be a serious failure, so the rule is absolute: notes are
private, and the export path must strip them the same way it strips tags.

No index. Notes are read when you open a row, not searched across — and if free-text
search over them is ever wanted, that is `pg_trgm` or a `tsvector`, decided then.

**Not on every table.** `profiles` is an account anchor holding no content, and
`item_skills` is a join row — a note on either would have nothing to annotate. The two
tables that hold selectable content are the two that carry notes.

---

## Favourites

`favorite` marks the entries you reach for most. Its only effect is that
**favourited entries sort to the top of their pool in the Inventory**.

Three fields now describe an entry without being part of it — worth being precise
about which does what, because they are easy to conflate:

| | `tags` | `note` | `favorite` |
|---|---|---|---|
| Shape | `text[]` | free text | `boolean` |
| Answers | "what kind of thing is this?" | "what should I remember about it?" | "is this one of my usual?" |
| Effect | filters the list | none, it is read | sorts to the top |

**It does not affect a CV.** Spec 01 settled that the Inventory has no meaningful
display order and that ordering belongs to the CV — `cv_items.position` is what
governs output. Favouriting changes what is convenient to find while building;
it never changes what a CV renders or in what order. A favourited entry that no
CV selects still appears on no CV.

**Not on `inventory_lines`.** Favouriting a single bullet would be a way of
saying "this is my best one", which is what a tag already says and says better,
because a tag can be filtered on. Entries are the things you scan a list of.

Like `tags` and `note`, `favorite` is ours and not `resume.json`'s, so export
drops it.

Deleting an entry removes years of material that cannot be retyped from memory. Both
content tables carry `deleted_at timestamptz`: **null means live, a timestamp means
deleted.** Nothing is removed from the database at delete time.

`item_skills` gets no `deleted_at` — see "Links are not deleted" below. Neither does
`tags`, which is metadata rather than content — see the `tags` table.

### Reads must filter, and RLS will not do it for you

The policies are `using (auth.uid() = user_id)`. They say nothing about `deleted_at`, so
**a soft-deleted row is still returned by every query that does not exclude it.** A
single forgotten filter puts deleted entries back on a CV.

Adding `deleted_at is null` to the RLS policy would fix that and break restore — the
owner could no longer see their own trash. So the filter belongs in the read path, and
the read path gets a view so it cannot be forgotten:

```sql
create view live_items with (security_invoker = true) as
  select * from inventory_items where deleted_at is null;

create view live_lines with (security_invoker = true) as
  select * from inventory_lines where deleted_at is null;
```

**`security_invoker = true` is not optional.** A Postgres view runs as its owner by
default, which means it reads the base table *bypassing RLS* — a view created without
this flag would serve every user's inventory to anyone with the anon key. With it, the
view runs as the caller and the base-table policies still apply.

Application queries read the views. Only the Trash screen and the restore path touch the
base tables.

### Deleting a parent does not cascade

`ON DELETE CASCADE` is a hard-delete mechanism. It does not fire on an `update`, so
soft-deleting an entry leaves its lines with `deleted_at` still null.

**This is deliberate — do not add a cascading trigger.** `deleted_at` on a row means
"the user deleted this row", and keeping that meaning exact is what makes restore
correct. If deleting an entry also stamped its lines, restoring the entry could not tell
the lines you had deleted individually from the ones the cascade took, and would
resurrect bullets you had removed on purpose.

The cost is that lines must be reached through their parent. Any query starting from
`inventory_lines` — tag filters especially — needs the join:

```sql
-- wrong: returns bullets belonging to deleted entries
select * from live_lines where tags @> '{backend}';

-- right
select l.* from live_lines l
  join live_items i on i.id = l.item_id
 where l.tags @> '{backend}';
```

The foreign keys stay `ON DELETE CASCADE`. They now only fire on purge, which is exactly
when cascading is wanted.

### Links are not deleted

`item_skills` has no `deleted_at`, for two reasons.

A link is not content — nobody wants to restore the fact that a job used Postgres
independently of the job. And the primary key is `(item_id, skill_id)`, so a soft-deleted
link would collide with re-adding the same link, forcing a partial unique index to work
around a problem that need not exist.

Links simply survive. A link whose item or skill is soft-deleted resolves to nothing
because the join goes through `live_items`, and restoring the item brings its links back
intact — which is the behaviour you want.

### CV selections point at soft-deleted rows

A CV holding a deleted entry keeps the row in `cv_items`; it renders as absent because
the join goes through `live_items`. Restoring the entry restores it to every CV that
still selects it.

This changes what spec 01 promised. That spec says deleting an item removes it from all
CVs on confirm. With soft delete the removal is reversible, so the warning should say the
entry will disappear from *N* CVs and can be restored from Trash — not that it is gone.

Snapshots are unaffected. They are frozen copies, not references.

### Purge

Trash is not storage. A scheduled job hard-deletes anything deleted long enough ago, and
the existing `ON DELETE CASCADE` cleans up children at that point:

```sql
delete from inventory_items
 where deleted_at < now() - interval '30 days';

delete from inventory_lines
 where deleted_at < now() - interval '30 days';
```

Thirty days is a starting guess, not a researched number. It wants `pg_cron`, and the
retention window is a product decision to confirm.

### Indexes must exclude deleted rows

Every hot-path index becomes partial. A pool with 200 deleted entries should not carry
them in the index that renders the page:

```sql
create index on inventory_items (user_id, kind, position) where deleted_at is null;
create index on inventory_lines (item_id, list_kind, position) where deleted_at is null;
```

Plus one non-partial index per table on `deleted_at` for the Trash screen and the purge
job, which are the only queries that want the deleted rows.

---

## Dates

`resume.json` dates are ISO 8601 **partial** dates — `2014`, `2014-06`, and
`2014-06-29` are all valid. Postgres `date` cannot represent them, so `start_date` and
`end_date` are `text` with a format check:

```sql
check (start_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$')
```

Because the format is ISO, plain string sorting is also chronological sorting — no
conversion needed to order entries by date.

---

## Row-level security

**Every one of the five tables needs RLS enabled and a policy.** In Supabase a table
without RLS is reachable through PostgREST with the anon key, so a missed table is a
data leak, not a missing feature.

```sql
alter table profiles        enable row level security;
alter table inventory_items enable row level security;
alter table inventory_lines enable row level security;
alter table item_skills     enable row level security;
alter table tags            enable row level security;
```

Three tables own a `user_id` (or are `profiles`) and take the direct policy:

```sql
create policy "own row" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own rows" on inventory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own tags" on tags
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Two have no `user_id` and are reached through their parent:

```sql
create policy "own lines" on inventory_lines
  for all using (
    exists (select 1 from inventory_items i
             where i.id = inventory_lines.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from inventory_items i
             where i.id = inventory_lines.item_id and i.user_id = auth.uid())
  );

create policy "own links" on item_skills
  for all using (
    exists (select 1 from inventory_items i
             where i.id = item_skills.item_id and i.user_id = auth.uid())
  ) with check (
    exists (select 1 from inventory_items i
             where i.id = item_skills.item_id and i.user_id = auth.uid())
  );
```

`with check` matters as much as `using`. Without it, `using` filters what you can read
but leaves inserts and updates unguarded — a user could attach a row to someone else's
parent. `item_skills` checks `item_id` only; `skill_id` is covered because both sides
must belong to the same user, which the application enforces on write.

---

## Indexes

| Index | Reason |
|---|---|
| `inventory_items (user_id, kind, favorite desc, position) where deleted_at is null` | every pool page is exactly this query, favourites first |
| `inventory_lines (item_id, list_kind, position) where deleted_at is null` | loading an entry's nested lists |
| `item_skills (skill_id)` | reverse lookup — which entries used this skill |
| `inventory_items using gin (tags) where deleted_at is null` | filtering a pool by tag |
| `inventory_lines using gin (tags) where deleted_at is null` | filtering bullets by tag while building a CV |
| `inventory_items (deleted_at)` | Trash screen and the purge job |
| `inventory_lines (deleted_at)` | Trash screen and the purge job |

`tags` needs no index of its own — the `unique (user_id, name)` constraint is already a
btree on exactly the columns the tag list and the registry lookups read. The two GIN
indexes above serve double duty: they answer "filter by tag" *and* the usage counts on
the tag management screen.

The partial indexes are the point: deleted rows are a minority that no page query ever
wants, so keeping them out keeps the indexes the size of the live data. See Soft delete.

### Ordering must be deterministic

`position` is not unique, so rows sharing a value sort arbitrarily — and differently
between page loads. **Every ordered query needs a tiebreaker:**

```sql
order by position, created_at, id
```

Inventory pool listings put favourites first, which is a display concern and
belongs only to those queries — never to the ones that assemble a CV:

```sql
order by favorite desc, position, created_at, id
```

The alternative — a unique constraint on `(user_id, kind, position)` — makes reordering
painful, because moving one row forces a rewrite of every row after it. Non-unique
positions plus a stable tiebreaker is the better trade.

### `updated_at` needs a trigger

Nothing maintains it otherwise; it would keep its insert value forever.

```sql
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

create trigger touch before update on inventory_items
  for each row execute function touch_updated_at();
```

Same trigger on `profiles`, `inventory_lines`, `item_skills`, and `tags` — **all five
tables carry `created_at` and `updated_at`**, so all five need it.

Timestamps are uniform on purpose. `inventory_lines` needs `created_at` because the
ordering tiebreaker above (`order by position, created_at, id`) depends on it, and
`item_skills` gets them so no table is the odd one out when the sync layer needs to ask
"what changed since I last looked?".

---

## How CV selection uses this

**Designed in [03 — CV Selection](03-cv-selection.md).** Summarised here only so this
document stands on its own:

```sql
cvs         (id, user_id, name, template_id, …)
cv_sections (cv_id, kind, position)
cv_items    (cv_id, item_id, position)
cv_lines    (cv_id, item_id, line_id, position)
```

Everything a CV selects points at ids in this spec, and every relation cascades — so
deleting an Inventory item removes it from every CV without triggers or application code.
`position` at all three levels is what lets two CVs order the same rows differently, which
is scenario 4.

Snapshot behaviour is asserted, not yet designed — spec 01 says a snapshot freezes at
Applied, but no snapshot tables exist. Being frozen copies rather than references, they
are unaffected by any of this; confirm when Applications is specced.

### Which CVs use this item

Scenario 5, and the warning shown before a delete. No schema change needed:

```sql
select distinct c.id, c.name
  from cvs c
  left join cv_items i on i.cv_id = c.id
  left join cv_lines l on l.cv_id = c.id
  left join inventory_lines il on il.id = l.line_id
 where i.item_id = :item_id
    or il.item_id = :item_id;
```

The second branch matters: a CV can use a bullet from an entry, so the entry counts as
used even when the entry itself was not selected directly.

---

## Open points

1. **`details` has no schema.** `studyType`, `score`, `entity`, `type`, and the three
   work engagement keys live in `jsonb` with nothing enforcing their shape. Acceptable
   while they are display-only — but `employmentType` and `workplaceType` are the two
   most likely to want filtering ("remote contract roles only"), and the moment they do,
   they want either a `check` constraint or promotion to real columns plus a GIN index on
   `details`. This is the weakest point in the design.
2. **`title` / `subtitle` are generic on purpose.** They read less clearly than
   `company` / `position` would. The mapping table above is what makes them
   comprehensible, so it must stay accurate.
3. **Import is empty-Inventory-only** (decided in spec 01), so no merge or
   deduplication logic is needed here.
4. **Enums are rigid, and `line_kind` already changed once.** `responsibilities` was
   added mid-design. `alter type … add value` cannot run inside a transaction on older
   Postgres, and a value can never be removed. If more kinds are likely, `text` with a
   `check (list_kind in (…))` is easier to evolve — a plain constraint swap. Enums are
   kept for now because they are self-documenting and both lists look stable.
5. **The date check validates shape, not validity.** `2024-13-45` passes the regex.
   Full validation needs a function that attempts a real date cast; low value while
   dates come from a date picker.
6. ~~**`cv_items.position` is scoped to its section**~~ — settled in
   [spec 03](03-cv-selection.md#cv_items).
