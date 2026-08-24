import * as React from "react"

import { SaveAsNewTemplateDialog } from "@/components/cv/save-as-new-template-dialog"
import { BlockTab } from "@/components/cv/persona-field-tree/block-tab"
import { DataTab } from "@/components/cv/persona-field-tree/data-tab"
import { PageTab } from "@/components/cv/persona-field-tree/page-tab"
import { StyleTab } from "@/components/cv/persona-field-tree/style-tab"
import { VisibilityTab } from "@/components/cv/persona-field-tree/visibility-tab"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTabSearchParam } from "@/hooks/use-tab-search-param"
import { saveAsNewTemplate } from "@/lib/application"
import type { CvTemplate } from "@/lib/cv-templates"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication } from "@/mocks/types"

export type PersonaFieldTreeProps = {
  application: DbApplication
  template: CvTemplate
}

/**
 * Persona print settings, in five tabs:
 * - **Visibility** — show/hide any Basics field or Section, hide individual
 *   fields within a Section's entries (e.g. Work's company name), and
 *   reorder Sections. Per-CV (Batch 3, docs/user-request.md) — two CVs off
 *   the same Persona can show different things.
 * - **Data** — show/hide one already-selected entry (a Skill, a Social
 *   link, a Work entry) without deselecting it, and pick which of its
 *   bullets (responsibilities, highlights, courses, keywords, roles) print.
 * - **Style** — edit the current Template's own named styles (font size,
 *   padding, colors, ...) for this CV only. Field list is manifest-driven —
 *   see `lib/style-property-schema.ts` — and reflects whatever properties
 *   the selected style actually has, same idea as json-ui's StyleEditor.
 * - **Page** — edit the Template's page config (paper size, orientation,
 *   margin, base typography) for this CV only — same manifest-driven
 *   approach as Style, over the fixed field set in
 *   `lib/page-property-schema.ts`.
 * - **Block Settings** — override one specific node instance in the template
 *   tree (a bullet marker's glyph, a separator, which style a section
 *   heading uses, ...) for this CV only — see `lib/cv-template-core.ts`'s
 *   `collectBlockNodeIds`.
 *
 * Every toggle writes straight through — see `lib/application.ts`'s
 * `setKindHidden`/`setFieldHidden`/`setItemHidden`/`setCvStyleProperty`/
 * `resetCvStyleProperty`/`setCvPageProperty`/`resetCvPageProperty`/
 * `setCvNodeOverride`/`resetCvNodeOverride`, and `lib/persona.ts`'s
 * `setLineSelected`/`reorderPersonaSections` (genuine Persona content,
 * unaffected by the visibility move).
 *
 * Each tab is its own file in this folder (`visibility-tab.tsx`,
 * `data-tab.tsx`, `style-tab.tsx`, `page-tab.tsx`, `block-tab.tsx`); pieces
 * shared by two or more tabs (row primitives, `PropertyRow`) live in
 * `shared.tsx`. This file is just the `Tabs` shell.
 */
export function PersonaFieldTree({ application, template }: PersonaFieldTreeProps) {
  const isFrozen = application.cvSnapshot !== null
  const [tab, setTab] = useTabSearchParam("tab", isFrozen ? "style" : "visibility")
  const personaStore = usePersonaStore()
  const [saveTemplateOpen, setSaveTemplateOpen] = React.useState(false)

  const hasOverrides =
    Object.keys(application.cvTemplateSettings.styles ?? {}).length > 0 ||
    Object.keys(application.cvTemplateSettings.page ?? {}).length > 0 ||
    Object.keys(application.cvTemplateSettings.nodes ?? {}).length > 0

  return (
    <Card className="flex h-full flex-col gap-0 overflow-hidden py-0">
      <CardContent className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
        <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
          <div className="mx-2 mt-2 flex items-center justify-between gap-2">
            <TabsList variant="line" className="w-fit self-start">
              {isFrozen ? null : (
                <>
                  <TabsTrigger value="visibility">Visibility</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                </>
              )}
              <TabsTrigger value="style">Style</TabsTrigger>
              <TabsTrigger value="page">Page</TabsTrigger>
              <TabsTrigger value="blocks">Block</TabsTrigger>
            </TabsList>
            {hasOverrides ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveTemplateOpen(true)}
              >
                Save as new template
              </Button>
            ) : null}
          </div>
          {isFrozen ? null : (
            <>
              <TabsContent
                value="visibility"
                className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
              >
                <VisibilityTab application={application} />
              </TabsContent>
              <TabsContent value="data" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                <DataTab application={application} />
              </TabsContent>
            </>
          )}
          <TabsContent value="style" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <StyleTab application={application} template={template} />
          </TabsContent>
          <TabsContent value="page" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <PageTab application={application} template={template} />
          </TabsContent>
          <TabsContent value="blocks" className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <BlockTab application={application} template={template} />
          </TabsContent>
        </Tabs>
      </CardContent>
      <SaveAsNewTemplateDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        onSubmit={async (fields) => {
          await saveAsNewTemplate(personaStore, application, template, fields)
        }}
      />
    </Card>
  )
}
