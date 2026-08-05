# Mock data

Demo dataset for one fictional user, shaped exactly like
[`docs/specs/02-inventory-data-model.md`](../../docs/specs/02-inventory-data-model.md).

Nothing here is wired into the app. Import it when a page needs something to render;
swapping it for real Supabase queries later should be a like-for-like replacement.

## What's in it

**Arya Nugraha** — a fictional Jakarta-based backend and platform engineer with a
14-year career.

| | Count |
|---|---|
| Items total | 68 |
| Lines (bullets, keywords, courses, roles) | 165 |
| Skill links | 45 |
| Distinct tags | 47 |

| Pool | Count | | Pool | Count |
|---|---|---|---|---|
| Work | 10 | | Certificates | 3 |
| Skills | 20 | | Languages | 3 |
| Projects | 4 | | Interests | 3 |
| Education | 2 | | Awards | 2 |
| Volunteer | 2 | | Publications | 2 |
| References | 2 | | | |

Plus the six Basics pools — name (2), headline (3), summary (3), contact (2),
location (2), social (3).

The data is deliberately **over-supplied and heavily tagged**. No sensible CV would
carry all ten jobs or all twenty skills — that is the point. Filtering by `leadership`
(8 lines) versus `backend` (19 lines) should produce visibly different résumés from the
same rows, which is the behaviour the product exists to demonstrate.

## Usage

```ts
import { mockDb, itemsOfKind, linesOf, skillsOf } from "@/mocks"

const jobs = itemsOfKind("work")
const bullets = linesOf("work-lumbung", "highlights")
const used = skillsOf("work-lumbung") // → Go, Kafka, PostgreSQL, …
```

Selectors available from `@/mocks`:

| Function | Returns |
|---|---|
| `itemsOfKind(kind)` | one pool, in display order |
| `linesOf(itemId, listKind)` | one nested list of an entry |
| `allLinesOf(itemId)` | every line on an entry, any list |
| `skillsOf(itemId)` | skills an entry used, resolved to full items |
| `entriesUsingSkill(skillId)` | the reverse lookup |
| `allTags()` | every tag in use, deduplicated and sorted |
| `linesWithTag(tag)` | lines carrying a tag |
| `poolCounts()` | row counts per pool |

| `contactDetails(item)` / `locationDetails(item)` | typed reads of a Basics item's `details` jsonb |
| `formatLocation(item)` | "Jakarta, DKI Jakarta 12190, ID" |

Or reach for `mockDb` directly — `{ profile, items, lines, itemSkills }` — when you want
the raw rows. `profile` is just `{ id }`: it is the account anchor and holds no content.

**Basics is a pool, like everything else.** There is no single identity record — name,
headline, summary, contact, location, and social are six pools with several rows each,
and a CV picks between them. The first five are pick-one at CV level; a CV may show
several socials.

## How it's organised

```
data/        the actual content, authored in a nested shape
flatten.ts   nested → flat database rows
types.ts     Db* row types + Source* authoring types
index.ts     runs the flatten, exports rows and selectors
```

**Why two shapes.** The database stores 165 line rows, each with a parent id, list
kind, and position. Hand-writing those is unreadable and easy to get wrong, so entries
are authored nested — a job simply carries its own `responsibilities` and `highlights`
arrays — and `flatten.ts` produces the flat rows. Line ids are generated from the
parent (`work-lumbung-r1`, `skill-go-k2`), so they stay stable and readable.

`flatten.ts` also enforces what the database will enforce: a skill link pointing at a
missing or non-skill item throws at import time rather than rendering as a silent blank.

## Two things to know

**Ids are readable slugs, not UUIDs.** `work-lumbung` rather than
`f47ac10b-58cc-...`, because debugging a demo is much easier that way. Production uses
`uuid`; generate real ones if this data is ever used to seed a database.

**Timestamps are synthesised, not authored.** `createdAt` / `updatedAt` are derived in
`flatten.ts` from a fixed epoch (2025-01-06) rather than `Date.now()`, so the dataset is
byte-identical on every reload — timestamps that drift between refreshes make the demo
impossible to screenshot or test. Roughly two rows in three read as edited after
creation. They are plausible, not meaningful.

**Every company, person, and URL is invented.** The `example.com` domains are
deliberate. Nothing here should be mistaken for a real person's record.
