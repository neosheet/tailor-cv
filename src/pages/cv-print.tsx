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
import { ResumeRender } from "@/components/cv/resume-render"
import { resolveCv } from "@/lib/cv"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"

/**
 * One CV at full size, ready for the browser's print dialog.
 *
 * A saved CV is a fixed (Persona, Template) pairing — see spec 06 — so unlike
 * the ad hoc Templates preview, there's no layout picker here.
 *
 * Renders outside the app shell: `data-print-root` is what the print rules in
 * `index.css` key off to hide the sidebar and header, so what prints is the page
 * and nothing else.
 */
export function CvPrintPage() {
  const { cvId } = useParams()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const resolved = cvId
    ? resolveCv(personaStore, inventoryStore, cvId)
    : undefined

  if (!resolved) {
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

  const { cv, document, template } = resolved

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
          {cv.name}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {template.name}
          </span>
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
        <ResumeRender document={document} templateId={template.id} />
      </div>
    </div>
  )
}
