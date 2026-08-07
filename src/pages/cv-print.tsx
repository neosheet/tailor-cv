import { ArrowLeftIcon, DownloadIcon } from "lucide-react"
import { Link, useParams } from "react-router"
import { PDFDownloadLink, PDFViewer } from "@react-pdf/renderer"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
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
import { resolveCv } from "@/lib/cv"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"

/**
 * Real PDF preview and download page for a saved CV.
 *
 * A saved CV is a fixed (Persona, Template) pairing, so unlike the Templates
 * preview, there's no layout picker here. The PDF viewer shows a live preview,
 * and the download button produces the actual `.pdf` file.
 *
 * Replaces the old `window.print()` approach from spec 05 — this is now a real
 * PDF generated via `@react-pdf/renderer`, with the DOM preview (in the gallery)
 * serving as a cheap approximation for reference only.
 */
export function CvPrintPage() {
  const { cvId } = useParams()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const resolved = cvId
    ? resolveCv(personaStore, inventoryStore, cvId)
    : undefined

  // Memoize the built PDF document so it doesn't rebuild on every render
  // (must be called unconditionally per React hooks rules)
  const pdfDocument = useMemo(
    () => (resolved ? buildPdfDocument(resolved.template.definition, resolved.document) : null),
    [resolved]
  )

  if (!resolved) {
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

  const { cv, document, template } = resolved

  const fileName = `${document.personaName} — ${template.name}.pdf`

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
          <PDFDownloadLink
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            document={pdfDocument as any}
            fileName={fileName}
          >
            {({ loading }) => (
              <Button size="sm" disabled={loading}>
                <DownloadIcon data-icon="inline-start" />
                {loading ? "Preparing…" : "Download PDF"}
              </Button>
            )}
          </PDFDownloadLink>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-md ring-1 ring-foreground/10">
        <PDFViewer
          showToolbar
          style={{
            width: "100%",
            height: "100%",
            border: 0,
          }}
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {pdfDocument as any}
        </PDFViewer>
      </div>
    </div>
  )
}
