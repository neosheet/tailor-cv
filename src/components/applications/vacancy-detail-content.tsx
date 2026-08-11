import { sanitizeHtml } from "@/lib/sanitize-html"
import { cn } from "@/lib/utils"

/**
 * Renders `vacancyDetail`'s Quill-authored HTML (headings/lists/links) in
 * place of the old `whitespace-pre-wrap` plain-text `<p>`/`<span>`. Sanitized
 * with DOMPurify before `dangerouslySetInnerHTML` since Quill's clipboard
 * paste path can carry through markup from arbitrary sources.
 */
export function VacancyDetailContent({
  html,
  className,
}: {
  html: string | null
  className?: string
}) {
  if (!html) return <span className={className}>—</span>

  return (
    <div
      className={cn(
        "min-w-0 text-sm leading-relaxed break-words [overflow-wrap:anywhere]",
        "[&_a]:underline [&_a]:decoration-dashed [&_a]:underline-offset-2",
        "[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:first:mt-0",
        "[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:first:mt-0",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_p]:my-1 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}
