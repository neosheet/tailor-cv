import { ResumePage, Section } from "@/components/cv/templates/primitives"
import { ContactLine } from "@/components/cv/templates/contact-line"
import type { ResumeDocument } from "@/mocks/cv"

/**
 * Tighter leading and a smaller type scale, so a long history still lands on one
 * page. Same structure as Classic — only the density differs.
 */
export function CompactTemplate({ document }: { document: ResumeDocument }) {
  return (
    <ResumePage className="px-10 py-8 text-[11px] leading-tight">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-300 pb-2">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">{document.name}</h1>
          {document.headline ? (
            <p className="text-[12px] text-neutral-600">{document.headline}</p>
          ) : null}
        </div>
        <ContactLine document={document} className="justify-end" />
      </header>

      {document.summary ? (
        <p className="mt-3 leading-snug text-neutral-700">{document.summary}</p>
      ) : null}

      <div className="mt-4 flex flex-col gap-4">
        {document.sections.map((section) => (
          <Section key={section.kind} section={section} />
        ))}
      </div>
    </ResumePage>
  )
}
