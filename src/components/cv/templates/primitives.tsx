import { formatPartialDate } from "@/components/inventory/columns"
import { cn } from "@/lib/utils"
import type { ResumeEntry, ResumeSection } from "@/mocks/cv"

/**
 * Shared building blocks for every template.
 *
 * Templates differ in page geometry and typography, not in what an entry is —
 * a job is a title, a role, a date range, and bullets whichever layout renders
 * it. Keeping that here means a new template is a layout file, not a rewrite.
 *
 * **These deliberately use raw colours, not the app's semantic tokens.** A CV is
 * paper: it is black on white in print and must look identical whether the app
 * is in light or dark mode. `bg-background` would make the printed page depend
 * on the viewer's theme, which is wrong.
 */

/** An A4 sheet. 794px is 210mm at 96dpi, so screen and print agree. */
export function ResumePage({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      data-resume-page
      className={cn(
        "min-h-[1123px] w-[794px] bg-white text-neutral-900",
        "print:min-h-0 print:w-full print:shadow-none",
        className
      )}
    >
      {children}
    </div>
  )
}

/** Kinds where a null `end_date` means "single date", not "ongoing". */
const SINGLE_DATE_KINDS: ResumeSection["kind"][] = [
  "award",
  "certificate",
  "publication",
]

function formatEntryDates(
  entry: ResumeEntry,
  kind: ResumeSection["kind"]
): string | null {
  const start = formatPartialDate(entry.startDate)
  if (!start) {
    return null
  }

  if (SINGLE_DATE_KINDS.includes(kind)) {
    return start
  }

  return `${start} – ${formatPartialDate(entry.endDate) ?? "Present"}`
}

export function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        "mb-2 border-b border-neutral-300 pb-1 text-[11px] font-semibold tracking-[0.12em] uppercase",
        className
      )}
    >
      {children}
    </h2>
  )
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 marker:text-neutral-400">
      {items.map((item, index) => (
        <li key={index} className="leading-snug">
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * One entry, rendered by kind. `break-inside-avoid` is what stops a job
 * splitting across a page boundary when printed.
 */
export function EntryBlock({
  entry,
  kind,
}: {
  entry: ResumeEntry
  kind: ResumeSection["kind"]
}) {
  if (kind === "skill") {
    const keywords = entry.lineGroups.find((g) => g.kind === "keywords")?.items
    return (
      <div className="break-inside-avoid leading-snug">
        <span className="font-semibold">{entry.title}</span>
        {entry.subtitle ? (
          <span className="text-neutral-500"> · {entry.subtitle}</span>
        ) : null}
        {keywords && keywords.length > 0 ? (
          <span className="text-neutral-600"> — {keywords.join(", ")}</span>
        ) : null}
      </div>
    )
  }

  if (kind === "language" || kind === "interest") {
    return (
      <div className="break-inside-avoid leading-snug">
        <span className="font-semibold">{entry.title}</span>
        {entry.subtitle ? (
          <span className="text-neutral-500"> · {entry.subtitle}</span>
        ) : null}
      </div>
    )
  }

  const dates = formatEntryDates(entry, kind)
  const studyType = asText(entry.details.studyType)
  const score = asText(entry.details.score)

  return (
    <div className="flex break-inside-avoid flex-col gap-0.5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-semibold">{entry.title}</h3>
        {dates ? (
          <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">
            {dates}
          </span>
        ) : null}
      </div>

      {entry.subtitle || studyType ? (
        <p className="text-neutral-600 italic">
          {[entry.subtitle, studyType].filter(Boolean).join(" · ")}
          {score ? <span className="not-italic"> ({score})</span> : null}
        </p>
      ) : null}

      {entry.summary ? (
        <p className="mt-0.5 leading-snug text-neutral-700">{entry.summary}</p>
      ) : null}

      {entry.lineGroups.map((group) => (
        <BulletList key={group.kind} items={group.items} />
      ))}
    </div>
  )
}

export function Section({
  section,
  className,
}: {
  section: ResumeSection
  className?: string
}) {
  return (
    <section className={cn("flex flex-col", className)}>
      <SectionHeading>{section.heading}</SectionHeading>
      <div
        className={cn(
          "flex flex-col",
          section.kind === "skill" ||
            section.kind === "language" ||
            section.kind === "interest"
            ? "gap-0.5"
            : "gap-3"
        )}
      >
        {section.entries.map((entry) => (
          <EntryBlock key={entry.id} entry={entry} kind={section.kind} />
        ))}
      </div>
    </section>
  )
}

function asText(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null
}
