import { ResumePage, Section } from "@/components/cv/templates/primitives"
import type { ResumeDocument, ResumeSection } from "@/mocks/cv"

/** Short, listy sections go in the rail; narrative sections fill the column. */
const RAIL_KINDS: ResumeSection["kind"][] = [
  "skill",
  "language",
  "interest",
  "certificate",
]

/**
 * Contact and short lists in a tinted left rail, Work and Education in the main
 * column. Reads well to a human and badly to a parser — the trade this template
 * exists to make.
 */
export function SidebarTemplate({ document }: { document: ResumeDocument }) {
  const rail = document.sections.filter((s) => RAIL_KINDS.includes(s.kind))
  const main = document.sections.filter((s) => !RAIL_KINDS.includes(s.kind))

  return (
    <ResumePage className="flex text-[12px]">
      <aside className="flex w-[30%] shrink-0 flex-col gap-5 bg-neutral-100 px-6 py-10">
        <div className="flex flex-col gap-1">
          <h2 className="text-[11px] font-semibold tracking-[0.12em] uppercase">
            Contact
          </h2>
          <div className="flex flex-col gap-0.5 text-[11px] break-words text-neutral-700">
            {document.contact?.email ? (
              <span>{document.contact.email}</span>
            ) : null}
            {document.contact?.phone ? (
              <span>{document.contact.phone}</span>
            ) : null}
            {document.location ? <span>{document.location}</span> : null}
            {document.contact?.url ? (
              <span>{document.contact.url.replace(/^https?:\/\//, "")}</span>
            ) : null}
            {document.socials.map((social) => (
              <span key={social.network}>
                {social.url?.replace(/^https?:\/\//, "") ?? social.network}
              </span>
            ))}
          </div>
        </div>

        {rail.map((section) => (
          <Section key={section.kind} section={section} />
        ))}
      </aside>

      <div className="flex flex-1 flex-col gap-6 px-8 py-10">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight">{document.name}</h1>
          {document.headline ? (
            <p className="text-[13px] text-neutral-600">{document.headline}</p>
          ) : null}
        </header>

        {document.summary ? (
          <p className="leading-relaxed text-neutral-700">{document.summary}</p>
        ) : null}

        {main.map((section) => (
          <Section key={section.kind} section={section} />
        ))}
      </div>
    </ResumePage>
  )
}
