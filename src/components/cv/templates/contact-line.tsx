import { cn } from "@/lib/utils"
import type { ResumeDocument } from "@/mocks/cv"

/** Contact details on one line, separated by dots. Shared by the templates. */
export function ContactLine({
  document,
  className,
}: {
  document: ResumeDocument
  className?: string
}) {
  const parts = [
    document.contact?.email,
    document.contact?.phone,
    document.location,
    document.contact?.url?.replace(/^https?:\/\//, ""),
    ...document.socials.map(
      (social) => social.url?.replace(/^https?:\/\//, "") ?? social.network
    ),
  ].filter((part): part is string => Boolean(part))

  if (parts.length === 0) {
    return null
  }

  return (
    <p
      className={cn(
        "flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-neutral-600",
        className
      )}
    >
      {parts.map((part, index) => (
        <span key={part}>
          {index > 0 ? <span className="mr-2 text-neutral-400">·</span> : null}
          {part}
        </span>
      ))}
    </p>
  )
}
