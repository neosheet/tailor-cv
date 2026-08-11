import * as React from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { TemplateCard } from "@/components/cv/template-card"
import { PreviewSelect } from "@/components/cv/preview-select"
import { TemplateViewDialog } from "@/components/cv/template-view-dialog"
import { cvTemplates } from "@/lib/cv-templates"
import { useInventoryStore } from "@/lib/inventory-store"
import { allPersonas, buildResumeDocument } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"

/**
 * Ad hoc, unsaved preview — pick any Persona, pick any Template, look at it.
 * Nothing here is stored; saving a specific pairing happens from the CV List
 * tab instead. See "Ad hoc preview stays free" in spec 06.
 */
export function TemplatesPanel() {
  // One dialog for the gallery rather than one per card.
  const { dialog, get, open, close } = useDialogSearchParams()
  const viewing =
    dialog === "view-template"
      ? (cvTemplates.find((template) => template.id === get("id")) ?? null)
      : null

  const inventoryStore = useInventoryStore()
  const personaStore = usePersonaStore()
  const personas = allPersonas(personaStore)
  const [personaId, setPersonaId] = React.useState(personas[0].id)
  const document = React.useMemo(
    () => buildResumeDocument(personaStore, inventoryStore, personaId),
    [personaStore, inventoryStore, personaId]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <PreviewSelect
          label="Preview Persona"
          value={personaId}
          onChange={setPersonaId}
          options={personas.map((persona) => ({
            value: persona.id,
            label: persona.name,
          }))}
        />
      </div>

      <Alert>
        <AlertTitle>Templates change presentation, never content</AlertTitle>
        <AlertDescription>
          Every preview below is the same Persona under a different layout.
          Switch the Persona above and all four change together — which
          entries and bullet points appear is a property of the Persona,
          never of the Template.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cvTemplates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            document={document}
            onView={() => open("view-template", { id: template.id })}
          />
        ))}
      </div>

      <TemplateViewDialog
        template={viewing}
        document={document}
        onClose={() => close(["id"])}
      />
    </div>
  )
}
