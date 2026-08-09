import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import { Link, useParams } from "react-router"
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer"
import { useMemo, useRef } from "react"
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  buildPdfDocument,
} from "@/components/cv/template-pdf-renderer"
import { ResumeRender } from "@/components/cv/resume-render"
import { resolveCv } from "@/lib/cv"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"

/**
 * CV detail page: the HTML tab is the DOM render (fast, live), the PDF tab is
 * the real `@react-pdf/renderer` output. Same document, two backends — the
 * DOM version is a cheap approximation, the PDF is the source of truth for
 * what actually downloads.
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

function CvResolved({ cv, document, template }: { cv: any; document: any; template: any }) {

  const fileName = `${document.personaName} — ${template.name}.pdf`
  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({
    contentRef,
    pageStyle: `
        @page {
          margin: ${template.definition.page.margin ?? 0}pt;
        }
      `,
    documentTitle: fileName, onAfterPrint: () => { console.log("Printed successfully!"); }
  });

  return (
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
            {template.name}
          </span>

          <Button onClick={reactToPrintFn}>Print</Button>
        </div>
      </div>

    <div className="bg-muted p-5 rounded-xl">
        <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
        <ResumeRender ref={contentRef} document={document} templateId={template.id} />
      </div>
    </div>
    </div>
  )
}


export function CvPrintPage() {

  const { cvId } = useParams()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const resolved = cvId
    ? resolveCv(personaStore, inventoryStore, cvId)
    : undefined

  // Memoize the built PDF document so it doesn't rebuild on every render
  // (must be called unconditionally per React hooks rules)


  if (!resolved) {
    return <CvUnresolved />
  }


  const { cv, document, template } = resolved
  return <CvResolved cv={cv} document={document} template={template} />
}
