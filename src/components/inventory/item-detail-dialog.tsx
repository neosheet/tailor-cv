import * as React from "react"
import {
  Code,
  CopyIcon,
  Ellipsis,
  PencilIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { Link } from "react-router"
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
import {
  Dialog,
  DialogBody,
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
import {
  formatPartialDate,
  LINE_HEADING,
  LINE_ORDER,
} from "@/components/inventory/columns"
import {
  allLinesOf,
  skillsOf,
  toggleFavorite,
  type DbInventoryItem,
  type ItemKind,
} from "@/lib/inventory"
import { useInventoryStore, type InventoryStore } from "@/lib/inventory-store"
import { cvsUsingItem, type ItemUsage } from "@/mocks/cv"

/**
 * Every field on one entry, read-only.
 *
 * Title and subtitle already appear in the dialog header, so the body only
 * needs the *other* fields — and the summary's label is the one that still
 * varies by `kind` (a company's is "Description", a reference's "Reference").
 */

type FieldLabels = {
  summary: string
}

const DEFAULT_LABELS: FieldLabels = {
  summary: "Summary",
}

const FIELD_LABELS: Partial<Record<ItemKind, Partial<FieldLabels>>> = {
  work: { summary: "Description" },
  volunteer: { summary: "Description" },
  project: { summary: "Description" },
  reference: { summary: "Reference" },
}

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
  onEditRow,
}: {
  /** Null closes the dialog — one instance serves the whole table. */
  item: DbInventoryItem | null
  /** Opened from the In-CVs count: scroll to that section rather than the top. */
  focusUsage?: boolean
  onClose: () => void
  /** Present only for pools with a form config; absent leaves Edit disabled. */
  onEditRow?: (item: DbInventoryItem) => void
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
          <DetailBody
            key={item.id}
            item={item}
            focusUsage={focusUsage}
            onEditRow={onEditRow}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function DetailBody({
  item,
  focusUsage,
  onEditRow,
}: {
  item: DbInventoryItem
  focusUsage: boolean
  onEditRow?: (item: DbInventoryItem) => void
}) {
  const store = useInventoryStore()
  const usage = cvsUsingItem(item.id)
  const usageRef = React.useRef<HTMLElement>(null)

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
        <DialogTitle className="text-3xl font-bold">{item.title}</DialogTitle>
        {item.subtitle ? (
          <DialogDescription>{item.subtitle}</DialogDescription>
        ) : (
          <DialogDescription className="sr-only">
            Details for {item.title}
          </DialogDescription>
        )}
      </DialogHeader>

      <DialogBody className="flex flex-col gap-4 py-4">
        <DetailsSection item={item} store={store} />

        {/* Omitted entirely when nothing uses the entry — an empty section is
          noise, and the In-CVs column already says as much with its dash. */}
        {usage.length > 0 ? (
          <>
            <section
              ref={usageRef}
              className="flex flex-col gap-2 rounded-xl border bg-muted/50 p-4"
            >
              <h3>Used In</h3>
              <UsageList item={item} usage={usage} store={store} />
            </section>
          </>
        ) : null}

        {item.note ? (
          <div className="-mx-4 mt-4 -mb-4 w-auto border-t bg-muted/50 p-4 text-xs text-muted-foreground">
            {item.note}
          </div>
        ) : null}
      </DialogBody>

      <DetailFooter item={item} store={store} onEditRow={onEditRow} />
    </>
  )
}

function DetailsSection({
  item,
  store,
}: {
  item: DbInventoryItem
  store: InventoryStore
}) {
  const labels = { ...DEFAULT_LABELS, ...FIELD_LABELS[item.kind] }
  const lines = allLinesOf(store, item.id)
  const skills = skillsOf(store, item.id)

  const start = formatPartialDate(item.startDate)
  const end = formatPartialDate(item.endDate)
  const dates = start ? `${start} – ${end ?? "Present"}` : null

  return (
    <>
      <dl className="flex flex-col gap-3">
        {/* Title and subtitle are already shown in the dialog header — repeating
          them here would just echo what the user is looking at. */}
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
  store,
  onEditRow,
}: {
  item: DbInventoryItem
  store: InventoryStore
  onEditRow?: (item: DbInventoryItem) => void
}) {
  // Mirrors the row's star. `toggleFavorite` mutates the shared row, so this
  // state exists only to re-render — both surfaces read the same object.
  const [favorite, setFavorite] = React.useState(item.favorite)
  return (
    <DialogFooter>
      <div className="flex w-full items-center justify-between gap-2">
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
          <DropdownMenuTrigger
            render={<Button variant="outline" size="icon" />}
          >
            <Ellipsis data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem
                disabled={!onEditRow}
                onClick={() => onEditRow?.(item)}
              >
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const next = await toggleFavorite(store, item.id)
                  setFavorite(next)
                }}
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
 * Which CVs draw on this entry, and how.
 *
 * The distinction that matters: a CV can use an entry's bullets without
 * selecting the entry as a heading, so "not selected directly" is a real state
 * rather than a bug. It is also the case a delete warning must not miss.
 */
function UsageList({
  item,
  usage,
  store,
}: {
  item: DbInventoryItem
  usage: ItemUsage[]
  store: InventoryStore
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
              {describeSelection(store, item, lineIds)}
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
function describeSelection(
  store: InventoryStore,
  item: DbInventoryItem,
  lineIds: string[]
) {
  const chosen = new Set(lineIds)

  const parts = LINE_ORDER.flatMap((kind) => {
    const total = allLinesOf(store, item.id).filter(
      (line) => line.listKind === kind
    ).length

    if (total === 0) {
      return []
    }

    const taken = allLinesOf(store, item.id).filter(
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
