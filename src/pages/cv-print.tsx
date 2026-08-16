import { ArrowLeftIcon, DownloadIcon, FileDownIcon, TriangleAlert } from "lucide-react"
import { Link, useParams } from "react-router"
import { useEffect, useRef, useState } from "react"
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { useSidebar } from "@/components/ui/sidebar"
import { PersonaFieldTree } from "@/components/cv/persona-field-tree"
import { ResumeRender } from "@/components/cv/resume-render"
import { SkillsCheckDialog } from "@/components/skills/skills-check-dialog"
import type { CvTemplate } from "@/lib/cv-templates"
import { resolveCv } from "@/lib/cv"
import { buildCvSnapshot } from "@/lib/cv-snapshot"
import { downloadCvSnapshot } from "@/lib/cv-snapshot-download"
import { useInventoryStore } from "@/lib/inventory-store"
import type { ResumeDocument } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { skillTitlesOf } from "@/lib/skill-check"
import { useSkillsCheck } from "@/hooks/use-skills-check"
import type { DbCv } from "@/mocks/types"

/**
 * CV detail page: a print preview (native `window.print()` via
 * `react-to-print`, the DOM render) beside a sidebar of Persona print
 * settings — field/section visibility and Section order. Both panels read
 * and write the same Persona, so a toggle here re-renders the preview live.
 */


function CvUnresolved() {
  return (
    <Empty className="min-h-72 flex-none border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <DownloadIcon />
        </EmptyMedia>
        <EmptyTitle>No such CV</EmptyTitle>
        <EmptyDescription>
          That CV doesn&apos;t exist, or it has been deleted.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          render={<Link to="/cvs" />}
          nativeButton={false}
        >
          Back to CVs
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function CvResolved({
  cv,
  document,
  template,
}: {
  cv: DbCv
  document: ResumeDocument
  template: CvTemplate
}) {
  const fileName = `${document.personaName} — ${template.name}.pdf`
  const contentRef = useRef<HTMLDivElement>(null)

  // In-memory only — never persisted, gone on refresh. See
  // docs/specs/14-missing-skills-check.md's "CV page (ephemeral)".
  const [skillsCheckOpen, setSkillsCheckOpen] = useState(false)
  const availableSkills = skillTitlesOf(document)
  const skillsCheck = useSkillsCheck()

  // The Page tab's margin override, same precedence the DOM renderer uses.
  const pageMargin = cv.templateSettings.page?.margin ?? template.definition.page.margin ?? 0
  const reactToPrintFn = useReactToPrint({
    contentRef,
    pageStyle: `
        @page {
          margin: ${pageMargin}pt;
        }
      `,
    documentTitle: fileName,
  })

  return (
    <>
      <div className="flex h-full flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            render={<Link to="/cvs" />}
            nativeButton={false}
          >
            <ArrowLeftIcon data-icon="inline-start" />
            {cv.name}
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {document.personaName} - {template.name}
            </span>

            <Button variant="outline" onClick={() => setSkillsCheckOpen(true)}>
              <TriangleAlert data-icon="inline-start" />
              Check skills
            </Button>

            <Button
              variant="outline"
              onClick={() => downloadCvSnapshot(buildCvSnapshot(cv, document, template))}
            >
              <FileDownIcon data-icon="inline-start" />
              Export
            </Button>

            <Button onClick={reactToPrintFn}>Print</Button>
          </div>
        </div>

        <div className="flex flex-1 gap-4 overflow-hidden">
          <aside className="w-80 shrink-0">
            <PersonaFieldTree cv={cv} template={template} />
          </aside>

          <div className="flex-1 overflow-auto rounded-xl bg-muted p-5">
            <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
              <ResumeRender
                ref={contentRef}
                document={document}
                templateId={template.id}
                definition={template.definition}
                settings={cv.templateSettings}
              />
            </div>
          </div>
        </div>
      </div>

      <SkillsCheckDialog
        open={skillsCheckOpen}
        onOpenChange={setSkillsCheckOpen}
        value={skillsCheck.value}
        onValueChange={skillsCheck.setValue}
        result={skillsCheck.result}
        onCheck={() => skillsCheck.onCheck(availableSkills)}
      />
    </>
  )
}

export function CvPrintPage() {
  const { cvId } = useParams()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const resolved = cvId
    ? resolveCv(personaStore, inventoryStore, cvId)
    : undefined

  // Icon-only nav on this page — the Persona settings sidebar and the print
  // preview need the room. Restored on the way out so every other page keeps
  // the user's normal expanded nav.
  const { setOpen } = useSidebar()
  useEffect(() => {
    setOpen(false)
    return () => setOpen(true)
  }, [setOpen])

  if (!resolved) {
    return <CvUnresolved />
  }

  const { cv, document, template } = resolved
  return <CvResolved cv={cv} document={document} template={template} />
}
