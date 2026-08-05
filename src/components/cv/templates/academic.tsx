import { ResumePage, Section } from "@/components/cv/templates/primitives"
import { ContactLine } from "@/components/cv/templates/contact-line"
import type { ResumeDocument, ResumeSection } from "@/mocks/cv"

/** Academic convention: credentials and output before employment. */
const PRIORITY: ResumeSection["kind"][] = [
  "education",
  "publication",
  "award",
  "certificate",
]

/**
 * Wide margins, generous spacing, and a reordering that puts Education and
 * Publications above Work.
 *
 * This is the one template that overrides the CV's own section order. It is a
 * deliberate exception: an academic CV has a conventional order, and someone
 * choosing this template is choosing that convention.
 */
export function AcademicTemplate({ document }: { document: ResumeDocument }) {
  const rank = (kind: ResumeSection["kind"]) => {
    const index = PRIORITY.indexOf(kind)
    return index === -1 ? PRIORITY.length : index
  }

  const sections = [...document.sections].sort(
    (a, b) => rank(a.kind) - rank(b.kind)
  )

  return (
    <ResumePage className="px-20 py-16 text-[12.5px]">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[26px] leading-none font-semibold tracking-tight">
          {document.name}
        </h1>
        {document.headline ? (
          <p className="text-[13px] text-neutral-600">{document.headline}</p>
        ) : null}
        <ContactLine document={document} />
      </header>

      {document.summary ? (
        <p className="mt-6 leading-relaxed text-neutral-700">
          {document.summary}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-7">
        {sections.map((section) => (
          <Section key={section.kind} section={section} />
        ))}
      </div>
    </ResumePage>
  )
}
