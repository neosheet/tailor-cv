import { ArrowLeftIcon, FileDownIcon, FileTextIcon } from "lucide-react"
import { Link, useParams } from "react-router"
import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { ResumeRender } from "@/components/cv/resume-render"
import { buildCvSnapshot } from "@/lib/cv-snapshot"
import { downloadCvSnapshot } from "@/lib/cv-snapshot-download"
import { findApplication, resolveApplicationCv, type ResolvedApplicationCv } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication } from "@/mocks/types"

/**
 * The CV attached to one application — mirrors `/cvs/:id/print`'s structure
 * (`ResumeRender` + Export/Print) but without the Persona settings sidebar:
 * this is a read-mostly view of a submission, not a place to keep tailoring
 * a CV. Resolution prefers the frozen `cvSnapshot` once status has left
 * `draft`, falling back to the live source CV while still in `draft` — see
 * `resolveApplicationCv` (`lib/application.ts`) and spec 10's "The freeze".
 */

function ApplicationCvUnresolved({ application }: { application: DbApplication | undefined }) {
  return (
    <Empty className="min-h-72 flex-none border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>{application ? "No CV attached" : "No such application"}</EmptyTitle>
        <EmptyDescription>
          {application
            ? "This application doesn't have a CV attached yet."
            : "That application doesn't exist, or it has been deleted."}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link to="/applications" />} nativeButton={false}>
          Back to Applications
        </Button>
      </EmptyContent>
    </Empty>
  )
}

function ApplicationCvResolved({
  application,
  resolved,
}: {
  application: DbApplication
  resolved: ResolvedApplicationCv
}) {
  const { document, template } = resolved
  const templateSettings =
    resolved.kind === "frozen" ? resolved.snapshot.templateSettings : application.cvTemplateSettings
  const fileName = `${document.personaName} — ${template.name}.pdf`
  const contentRef = useRef<HTMLDivElement>(null)
  const pageMargin = templateSettings.page?.margin ?? template.definition.page.margin ?? 0
  const reactToPrintFn = useReactToPrint({
    contentRef,
    pageStyle: `
        @page {
          margin: ${pageMargin}pt;
        }
      `,
    documentTitle: fileName,
  })

  function handleExport() {
    const snapshot =
      resolved.kind === "frozen"
        ? resolved.snapshot
        : buildCvSnapshot(
            { name: application.title, note: null, tags: [], templateSettings: application.cvTemplateSettings },
            resolved.document,
            resolved.template
          )
    downloadCvSnapshot(snapshot)
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/applications" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {application.title}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {document.personaName} - {template.name}
            {resolved.kind === "frozen" ? " (frozen)" : null}
          </span>

          <Button variant="outline" onClick={handleExport}>
            <FileDownIcon data-icon="inline-start" />
            Export
          </Button>

          <Button onClick={reactToPrintFn}>Print</Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto rounded-xl bg-muted p-5">
        <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
          <ResumeRender
            ref={contentRef}
            document={document}
            templateId={template.id}
            definition={template.definition}
            settings={templateSettings}
          />
        </div>
      </div>
    </div>
  )
}

export function ApplicationCvPrintPage() {
  const { id } = useParams()
  const applicationStore = useApplicationStore()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()

  const application = id ? findApplication(applicationStore, id) : undefined
  const resolved = application
    ? resolveApplicationCv(application, personaStore, inventoryStore)
    : undefined

  if (!application || !resolved) {
    return <ApplicationCvUnresolved application={application} />
  }

  return <ApplicationCvResolved application={application} resolved={resolved} />
}
