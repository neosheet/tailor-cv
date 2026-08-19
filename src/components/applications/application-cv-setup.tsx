import * as React from "react"
import { FileTextIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { setApplicationCvBase } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { allTemplates, findTemplate } from "@/lib/cv-templates"
import { allPersonas } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication } from "@/mocks/types"

/**
 * The CV tab's lazy-setup empty state (docs/specs/15-cv-embedded-in-applications.md):
 * shown whenever `resolveApplicationCv` returns nothing — no `cvSnapshot`
 * and no `cvPersonaId`/`cvTemplateId` yet. The Persona + Template `<Select>`
 * pair is copied from `CvFormDialog`'s old picker JSX — that file is
 * deleted once nothing else needs it, but this exact control pattern is
 * reused here. Submitting writes straight to the application via
 * `setApplicationCvBase`, no dialog. `onImportClick` opens the caller's
 * `ImportCvSettingsDialog` instead — copying another application's CV
 * settings is also a valid way to leave this empty state, not just picking
 * a Persona/Template from scratch.
 */
export function ApplicationCvSetup({
  application,
  onImportClick,
}: {
  application: DbApplication
  onImportClick: () => void
}) {
  const applicationStore = useApplicationStore()
  const personaStore = usePersonaStore()
  const [saving, setSaving] = React.useState(false)

  const personaOptions = allPersonas(personaStore).map((persona) => ({
    value: persona.id,
    label: persona.name,
  }))
  const templateOptions = allTemplates(personaStore.cvTemplates).map((template) => ({
    value: template.id,
    label: template.name,
  }))

  const [personaId, setPersonaId] = React.useState(personaOptions[0]?.value ?? "")
  const [templateId, setTemplateId] = React.useState(templateOptions[0]?.value ?? "")

  const canSubmit = personaId !== "" && templateId !== "" && !saving

  async function handleSubmit() {
    if (!personaId || !templateId) return

    setSaving(true)
    try {
      const template = findTemplate(templateId, personaStore.cvTemplates)
      await setApplicationCvBase(
        applicationStore,
        application.id,
        personaId,
        templateId,
        template?.defaultFieldVisibility
      )
    } finally {
      setSaving(false)
    }
  }

  if (personaOptions.length === 0) {
    return (
      <Empty className="min-h-72 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileTextIcon />
          </EmptyMedia>
          <EmptyTitle>No Personas yet</EmptyTitle>
          <EmptyDescription>
            Create a Persona first — a CV always starts from one. Or import CV
            settings from another application instead.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={onImportClick}>
            Import CV settings
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileTextIcon />
        </EmptyMedia>
        <EmptyTitle>Set up this application's CV</EmptyTitle>
        <EmptyDescription>
          Pick a Persona and Template to start tailoring a CV for this application.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <FieldGroup className="w-full max-w-sm">
          <Field>
            <FieldLabel htmlFor="application-cv-persona">Persona</FieldLabel>
            <Select
              items={personaOptions}
              value={personaId}
              onValueChange={(next) => setPersonaId(next as string)}
            >
              <SelectTrigger id="application-cv-persona" className="w-full">
                <SelectValue placeholder="Select a persona…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {personaOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="application-cv-template">Template</FieldLabel>
            <Select
              items={templateOptions}
              value={templateId}
              onValueChange={(next) => setTemplateId(next as string)}
            >
              <SelectTrigger id="application-cv-template" className="w-full">
                <SelectValue placeholder="Select a template…" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {templateOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>
        <div className="flex items-center gap-2">
          <Button size="sm" disabled={!canSubmit} onClick={handleSubmit}>
            {saving ? "Setting up…" : "Set up CV"}
          </Button>
          <span className="text-sm text-muted-foreground">or</span>
          <Button variant="outline" size="sm" onClick={onImportClick}>
            Import CV settings
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}
