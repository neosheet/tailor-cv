import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ResumeRender } from "@/components/cv/resume-render"
import type { CvTemplate } from "@/lib/cv-templates"
import type { ResumeDocument } from "@/mocks/cv"

/** A template at close to full page size, rendered with real CV content. */
export function TemplateViewDialog({
  template,
  document,
  onClose,
}: {
  /** Null closes the dialog — one instance serves the whole gallery. */
  template: CvTemplate | null
  document: ResumeDocument
  onClose: () => void
}) {
  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[92vh] sm:max-w-3xl">
        {template ? (
          <>
            <DialogHeader>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{template.pageSize}</span>
                <span>{template.density}</span>
                <span>{template.atsSafe ? "Parser-safe" : "Human-first"}</span>
                <span>Showing “{document.cvName}”</span>
              </div>

              <div className="mx-auto w-fit overflow-hidden rounded-md shadow-lg ring-1 ring-foreground/10">
                <ResumeRender
                  document={document}
                  templateId={template.id}
                  scale={0.82}
                />
              </div>
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
