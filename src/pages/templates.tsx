import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PageHeader } from "@/components/layout/page-header"
import { TemplateCard } from "@/components/cv/template-card"
import { PreviewSelect } from "@/components/cv/preview-select"
import { TemplateViewDialog } from "@/components/cv/template-view-dialog"
import { cvTemplates, type CvTemplate } from "@/lib/cv-templates"
import { allCvs, buildResumeDocument } from "@/mocks/cv"
import { sections } from "@/lib/navigation"

export function TemplatesPage() {
  // One dialog for the gallery rather than one per card.
  const [viewing, setViewing] = React.useState<CvTemplate | null>(null)

  const cvs = allCvs()
  // Preview-only, like the template picker on a CV — nothing here is stored.
  const [cvId, setCvId] = React.useState(cvs[0].id)
  const document = React.useMemo(() => buildResumeDocument(cvId), [cvId])

  return (
    <>
      <PageHeader
        title={sections.templates.title}
        description={sections.templates.description}
        action={
          <PreviewSelect
            label="Preview CV"
            value={cvId}
            onChange={setCvId}
            options={cvs.map((cv) => ({ value: cv.id, label: cv.name }))}
          />
        }
      />

      <Alert>
        <AlertTitle>Templates change presentation, never content</AlertTitle>
        <AlertDescription>
          Every preview below is the same CV under a different layout. Switch
          the CV above and all four change together — which entries and bullet
          points appear is a property of the CV, never of the template.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cvTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            document={document}
            onView={() => setViewing(template)}
          />
        ))}
      </div>

      <TemplateViewDialog
        template={viewing}
        document={document}
        onClose={() => setViewing(null)}
      />
    </>
  )
}
