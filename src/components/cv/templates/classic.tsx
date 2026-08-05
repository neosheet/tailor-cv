import { ResumePage, Section } from "@/components/cv/templates/primitives"
import { ContactLine } from "@/components/cv/templates/contact-line"
import type { ResumeDocument } from "@/mocks/cv"

/**
 * Centred header over full-width sections. No columns, no colour, nothing a
 * résumé parser can trip on — the safe default.
 */
export function ClassicTemplate({ document }: { document: ResumeDocument }) {
  return (
    <ResumePage className="px-14 py-12 text-[12.5px]">
      <header className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{document.name}</h1>
        {document.headline ? (
          <p className="text-[13px] text-neutral-600">{document.headline}</p>
        ) : null}
        <ContactLine document={document} className="justify-center" />
      </header>

      {document.summary ? (
        <p className="mt-5 text-center leading-relaxed text-neutral-700">
          {document.summary}
        </p>
      ) : null}

      <div className="mt-7 flex flex-col gap-6">
        {document.sections.map((section) => (
          <Section key={section.kind} section={section} />
        ))}
      </div>
    </ResumePage>
  )
}
