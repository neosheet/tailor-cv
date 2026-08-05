import * as React from "react"
import { ArrowLeftIcon, PrinterIcon } from "lucide-react"
import { Link, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PreviewSelect } from "@/components/cv/preview-select"
import { ResumeRender } from "@/components/cv/resume-render"
import { cvTemplates } from "@/lib/cv-templates"
import { buildResumeDocument, findCv } from "@/mocks/cv"

/**
 * One CV at full size, ready for the browser's print dialog.
 *
 * Renders outside the app shell: `data-print-root` is what the print rules in
 * `index.css` key off to hide the sidebar and header, so what prints is the page
 * and nothing else.
 */
export function CvPrintPage() {
  const { cvId } = useParams()
  const cv = cvId ? findCv(cvId) : undefined

  if (!cv) {
    return (
      <Empty className="min-h-72 flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <PrinterIcon />
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

  return <CvPreview cvId={cv.id} name={cv.name} />
}

function CvPreview({ cvId, name }: { cvId: string; name: string }) {
  // Preview-only: the chosen layout is not saved to the CV. Which template an
  // employer actually received belongs to the application. See spec 03.
  const [templateId, setTemplateId] = React.useState(cvTemplates[0].id)
  const document = React.useMemo(() => buildResumeDocument(cvId), [cvId])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Button
          variant="ghost"
          size="sm"
          render={<Link to="/cvs" />}
          nativeButton={false}
        >
          <ArrowLeftIcon data-icon="inline-start" />
          {name}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <PreviewSelect
            label="Template"
            value={templateId}
            onChange={setTemplateId}
            options={cvTemplates.map((template) => ({
              value: template.id,
              label: template.name,
            }))}
          />
          <Button size="sm" onClick={() => window.print()}>
            <PrinterIcon data-icon="inline-start" />
            Print
          </Button>
        </div>
      </div>

      <div
        data-print-root
        className="mx-auto w-fit overflow-x-auto shadow-lg ring-1 ring-foreground/10 print:shadow-none print:ring-0"
      >
        <ResumeRender document={document} templateId={templateId} />
      </div>
    </div>
  )
}
