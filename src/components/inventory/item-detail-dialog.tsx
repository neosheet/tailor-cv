import * as React from "react"
import {
  ChevronDownIcon,
  Code,
  CopyIcon,
  Ellipsis,
  FilePlus2Icon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { Link } from "react-router"
import { formatDistanceToNow } from 'date-fns';
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AddToCvDialog } from "@/components/inventory/add-to-cv-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { formatPartialDate } from "@/components/inventory/columns"
import {
  allLinesOf,
  skillsOf,
  toggleFavorite,
  type DbInventoryItem,
  type ItemKind,
  type LineKind,
} from "@/mocks"
import { cvsUsingItem, type ItemUsage } from "@/mocks/cv"

/**
 * Every field on one entry, read-only.
 *
 * Built against the shared item shape rather than per pool, so it works for any
 * `kind`. Only the field *labels* differ — a `title` is a company on Work and an
 * institution on Education — which is what `FIELD_LABELS` carries.
 */

type FieldLabels = {
  title: string
  subtitle: string
  summary: string
}

const DEFAULT_LABELS: FieldLabels = {
  title: "Title",
  subtitle: "Subtitle",
  summary: "Summary",
}

const FIELD_LABELS: Partial<Record<ItemKind, Partial<FieldLabels>>> = {
  work: { title: "Company", subtitle: "Position", summary: "Description" },
  volunteer: {
    title: "Organisation",
    subtitle: "Position",
    summary: "Description",
  },
  education: { title: "Institution", subtitle: "Area" },
  skill: { title: "Skill", subtitle: "Level" },
  project: { title: "Project", summary: "Description" },
  award: { title: "Award", subtitle: "Awarder" },
  certificate: { title: "Certificate", subtitle: "Issuer" },
  publication: { title: "Publication", subtitle: "Publisher" },
  language: { title: "Language", subtitle: "Fluency" },
  interest: { title: "Interest" },
  reference: { title: "Name", subtitle: "Role", summary: "Reference" },
}

const LINE_HEADING: Record<LineKind, string> = {
  responsibilities: "Responsibilities",
  highlights: "Highlights",
  courses: "Courses",
  keywords: "Keywords",
  roles: "Roles",
}

/** Order lists appear in, so a dialog reads the same way every time. */
const LINE_ORDER: LineKind[] = [
  "responsibilities",
  "highlights",
  "courses",
  "keywords",
  "roles",
]

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  )
}

function TextField({ label, value }: { label: string; value: string | null }) {
  if (!value) {
    return null
  }

  return <Field label={label}>{value}</Field>
}

export function ItemDetailDialog({
  item,
  focusUsage = false,
  onClose,
}: {
  /** Null closes the dialog — one instance serves the whole table. */
  item: DbInventoryItem | null
  /** Opened from the In-CVs count: scroll to that section rather than the top. */
  focusUsage?: boolean
  onClose: () => void
}) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[85vh] gap-0 sm:max-w-2xl">
        {/* Keyed on the item so each row opens fresh, scrolled to the top. */}
        {item ? (
          <DetailBody key={item.id} item={item} focusUsage={focusUsage} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({
  item,
  focusUsage,
}: {
  item: DbInventoryItem
  focusUsage: boolean
}) {
  const usage = cvsUsingItem(item.id)
  const usageRef = React.useRef<HTMLElement>(null)
  const [addingToCv, setAddingToCv] = React.useState(false)

  // Opened from the count, so bring that section into view. A DOM side effect,
  // which is what an effect is actually for.
  React.useEffect(() => {
    if (focusUsage) {
      usageRef.current?.scrollIntoView({ block: "start" })
    }
  }, [focusUsage])

  return (
    <>
      <DialogHeader className="pb-4">
        <DialogTitle>{item.title}</DialogTitle>
        {item.subtitle ? (
          <DialogDescription>{item.subtitle}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">
            Details for {item.title}
          </DialogDescription>
        )}
      </DialogHeader>

      <div className="flex flex-col gap-4 w-auto -mx-4 py-4 max-h-[70vh] px-4 overflow-y-auto">
        <DetailsSection item={item} />

        {/* Omitted entirely when nothing uses the entry — an empty section is
          noise, and the In-CVs column already says as much with its dash. */}
        {usage.length > 0 ? (
          <>
            <section ref={usageRef} className="flex rounded-xl p-4 bg-muted/50 border flex-col gap-2">
              <h3>Used In</h3>
              <UsageList item={item} usage={usage} />
            </section>
          </>
        ) : null}

        {item.note ? (
          <div className="text-xs text-muted-foreground border-t mt-4 bg-muted/50 p-4 -mx-4 -mb-4 w-auto">
            {item.note}
          </div>
        ) : null}
      </div>

      <DetailFooter item={item} onAddToCv={() => setAddingToCv(true)} />

      <AddToCvDialog
        item={item}
        open={addingToCv}
        onClose={() => setAddingToCv(false)}
      />
    </>
  )
}

function DetailsSection({ item }: { item: DbInventoryItem }) {
  const labels = { ...DEFAULT_LABELS, ...FIELD_LABELS[item.kind] }
  const lines = allLinesOf(item.id)
  const skills = skillsOf(item.id)

  const start = formatPartialDate(item.startDate)
  const end = formatPartialDate(item.endDate)
  const dates = start ? `${start} – ${end ?? "Present"}` : null

  return (
    <>
      <dl className="flex flex-col gap-3">
        <TextField label={labels.title} value={item.title} />
        <TextField label={labels.subtitle} value={item.subtitle} />
        {dates ? <Field label="Dates">{dates}</Field> : null}
        <TextField label={labels.summary} value={item.summary} />
        {item.yearsExperience !== null ? (
          <Field label="Years of experience">{item.yearsExperience}</Field>
        ) : null}
        {item.url ? (
          <Field label="Link">
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4 hover:text-primary"
            >
              {item.url.replace(/^https?:\/\//, "")}
            </a>
          </Field>
        ) : null}

        {Object.entries(item.details).map(([key, value]) =>
          typeof value === "string" || typeof value === "number" ? (
            <Field key={key} label={humanise(key)}>
              {value}
            </Field>
          ) : null
        )}
      </dl>




      {skills.length > 0 ? (
        <>
          <Separator />
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Skills used</h3>
            <div className="flex flex-wrap gap-1">
              {skills.map((skill) => (
                <Badge key={skill.id} variant="outline">
                  {skill.title}
                </Badge>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {LINE_ORDER.map((kind) => {
        const group = lines
          .filter((line) => line.listKind === kind)
          .sort((a, b) => a.position - b.position)

        if (group.length === 0) {
          return null
        }

        return (
          <section key={kind} className="flex flex-col gap-2">
            <Separator />
            <h3 className="text-sm font-medium">
              {LINE_HEADING[kind]}
              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                {group.length}
              </span>
            </h3>
            <ul className="flex flex-col gap-2">
              {group.map((line) => (
                // Tags sit on their own row under the content, so a long bullet
                // isn't squeezed by the chips beside it.
                <li key={line.id} className="flex flex-col gap-1.5 text-sm">
                  <span>{line.content}</span>
                  {line.tags.length > 0 ? (
                    <span className="flex flex-wrap gap-1">
                      {line.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        )
      })}

    </>
  )
}

/**
 * Pinned to the bottom of the dialog so the provenance line and the actions stay
 * reachable however far the content scrolls.
 *
 * The negative margins pull it out to the dialog's edges, since `DialogContent`
 * supplies the padding this needs to sit outside.
 */
function DetailFooter({
  item,
  onAddToCv,
}: {
  item: DbInventoryItem
  onAddToCv: () => void
}) {
  // Mirrors the row's star. `toggleFavorite` mutates the shared row, so this
  // state exists only to re-render — both surfaces read the same object.
  const [favorite, setFavorite] = React.useState(item.favorite)
  return (
    <DialogFooter>
      <div className="flex items-center justify-between gap-2 w-full">
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="outline">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
            <Ellipsis data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={onAddToCv}>
                <FilePlus2Icon />
                Add to CV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setFavorite(toggleFavorite(item.id))}
              >
                <StarIcon className={favorite ? "fill-current" : undefined} />
                {favorite ? "Remove from favourites" : "Favourite"}
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <CopyIcon />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                {/* for id in database */}
                <Code />
                Copy ID
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" disabled>
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </DialogFooter>
  )
}

/**
 * These are real ISO instants, unlike an item's partial `start_date`, so the
 * browser's own formatter is safe here.
 */
function formatTimestamp(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

/**
 * Which CVs draw on this entry, and how.
 *
 * The distinction that matters: a CV can use an entry's bullets without
 * selecting the entry as a heading, so "not selected directly" is a real state
 * rather than a bug. It is also the case a delete warning must not miss.
 */
function UsageList({
  item,
  usage,
}: {
  item: DbInventoryItem
  usage: ItemUsage[]
}) {
  if (usage.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not on any CV yet — nothing selects this, so deleting it would affect
        nothing.
      </p>
    )
  }

  return (
    <ItemGroup className="gap-1">
      {usage.map(({ cv, entrySelected, lineIds }) => (
        <Item key={cv.id} variant="outline">
          <ItemContent>
            <ItemTitle>
              <Link
                to={`/cvs/${cv.id}/print`}
                className="hover:underline hover:underline-offset-4"
              >
                {cv.name}
              </Link>
            </ItemTitle>
            <ItemDescription>
              {entrySelected
                ? "Entry included"
                : "Bullets only — entry not selected"}
              {describeSelection(item, lineIds)}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            {entrySelected ? null : <Badge variant="secondary">Partial</Badge>}
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  )
}

/**
 * "· 2 of 4 responsibilities · 3 of 4 highlights".
 *
 * Broken down per list kind rather than totalled, because the kinds are
 * different things — a combined "5 of 8" told you a number and nothing else,
 * and used the database's word for them.
 */
function describeSelection(item: DbInventoryItem, lineIds: string[]) {
  const chosen = new Set(lineIds)

  const parts = LINE_ORDER.flatMap((kind) => {
    const total = allLinesOf(item.id).filter(
      (line) => line.listKind === kind
    ).length

    if (total === 0) {
      return []
    }

    const taken = allLinesOf(item.id).filter(
      (line) => line.listKind === kind && chosen.has(line.id)
    ).length

    return [`${taken} of ${total} ${LINE_HEADING[kind].toLowerCase()}`]
  })

  return parts.length > 0 ? ` · ${parts.join(" · ")}` : null
}

/** `studyType` → "Study type", for the untyped keys inside `details`. */
function humanise(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
