import { PropertyRow } from "@/components/cv/persona-field-tree/shared"
import { resetCvPageProperty, setCvPageProperty } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import type { CvTemplate } from "@/lib/cv-templates"
import { EDITABLE_PAGE_KEYS, PAGE_PROPERTY_SCHEMA } from "@/lib/page-property-schema"
import { STYLE_GROUP_ORDER, type StyleGroup } from "@/lib/style-property-schema"
import type { DbApplication } from "@/mocks/types"

export function PageTab({
  application,
  template,
}: {
  application: DbApplication
  template: CvTemplate
}) {
  const applicationStore = useApplicationStore()
  const page = template.definition.page
  const override = application.cvTemplateSettings.page ?? {}

  // Only the scalar fields `page-property-schema.ts` knows how to edit —
  // `page`/`override` also carry `header`/`footer` (structured TemplateNode
  // content), which don't fit a `string | number` control.
  const effective: Record<string, string | number> = {}
  for (const key of EDITABLE_PAGE_KEYS) {
    const value = override[key] ?? page[key]
    if (value !== undefined) {
      effective[key] = value as string | number
    }
  }

  const grouped: Partial<Record<StyleGroup, (keyof typeof PAGE_PROPERTY_SCHEMA)[]>> = {}
  for (const key of EDITABLE_PAGE_KEYS) {
    const group = PAGE_PROPERTY_SCHEMA[key]!.group
    ;(grouped[group] ??= []).push(key)
  }

  return (
    <div className="flex flex-col gap-3">
      {STYLE_GROUP_ORDER.filter((group) => grouped[group]).map((group) => (
        <div key={group}>
          <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group}
          </p>
          <div className="flex flex-col px-2">
            {grouped[group]!.map((key) => (
              <PropertyRow
                key={key}
                propKey={key}
                def={PAGE_PROPERTY_SCHEMA[key]!}
                value={effective[key]}
                overridden={key in override}
                onChange={(next) =>
                  void setCvPageProperty(applicationStore, application.id, key, next)
                }
                onReset={() => void resetCvPageProperty(applicationStore, application.id, key)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
