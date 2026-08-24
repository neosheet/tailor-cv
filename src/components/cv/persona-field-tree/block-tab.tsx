import * as React from "react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PropertyRow } from "@/components/cv/persona-field-tree/shared"
import { resetCvNodeOverride, setCvNodeOverride } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { collectBlockNodeIds } from "@/lib/cv-template-core"
import type { CvTemplate } from "@/lib/cv-templates"
import { humanize } from "@/lib/style-property-schema"
import type { DbApplication } from "@/mocks/types"

export function BlockTab({
  application,
  template,
}: {
  application: DbApplication
  template: CvTemplate
}) {
  const applicationStore = useApplicationStore()
  const blockMeta = template.definition.blocksSchema

  const nodeIds = React.useMemo(
    () => collectBlockNodeIds(template.definition),
    [template.definition]
  )

  const groups = React.useMemo(() => {
    const byBlock = new Map<string, typeof nodeIds>()
    for (const entry of nodeIds) {
      const list = byBlock.get(entry.blockName)
      if (list) {
        list.push(entry)
      } else {
        byBlock.set(entry.blockName, [entry])
      }
    }
    return [...byBlock.entries()]
  }, [nodeIds])

  const [selected, setSelected] = React.useState(nodeIds[0]?.id ?? "")

  if (nodeIds.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        This template defines no customizable nodes.
      </p>
    )
  }

  const current = nodeIds.find((entry) => entry.id === selected) ?? nodeIds[0]
  const nodeOptions = nodeIds.map((entry) => ({
    value: entry.id,
    label: humanize(entry.id),
  }))

  const styleMeta = template.definition.stylesSchema
  const styleOptions = [
    { value: "", label: "Template default" },
    ...Object.keys(template.definition.styles).map((name) => ({
      value: name,
      label: styleMeta?.[name]?.title ?? humanize(name),
    })),
  ]

  const override = application.cvTemplateSettings.nodes?.[current.id] ?? {}
  const overriddenStyle = Array.isArray(override.styles)
    ? (override.styles[0] ?? "")
    : (override.styles ?? "")
  const overriddenText = override.text

  return (
    <div className="flex flex-col gap-3">
      <p className="px-2 text-sm text-muted-foreground">
        Override one specific spot in the template — grouped by which block it
        belongs to. Changes apply only to this CV.
      </p>

      <div className="flex flex-col gap-1 px-2">
        <span className="text-xs font-medium text-muted-foreground">Node</span>
        <Select
          items={nodeOptions}
          value={current.id}
          onValueChange={(next) => setSelected(next as string)}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {groups.map(([blockName, entries]) => (
                <React.Fragment key={blockName}>
                  <p className="px-2 pt-2 pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                    {blockMeta?.[blockName]?.title ?? humanize(blockName)}
                  </p>
                  {entries.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {humanize(entry.id)}
                    </SelectItem>
                  ))}
                </React.Fragment>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {blockMeta?.[current.blockName]?.description ? (
          <p className="text-xs text-muted-foreground">
            {blockMeta[current.blockName].description}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col px-2">
        <PropertyRow
          propKey="styles"
          def={{ title: "Style", input: "select", group: "Other", options: styleOptions }}
          value={overriddenStyle}
          overridden={override.styles !== undefined}
          onChange={(next) =>
            next === ""
              ? void resetCvNodeOverride(applicationStore, application.id, current.id, "styles")
              : void setCvNodeOverride(applicationStore, application.id, current.id, {
                  styles: String(next),
                })
          }
          onReset={() =>
            void resetCvNodeOverride(applicationStore, application.id, current.id, "styles")
          }
        />

        {current.hasText ? (
          <PropertyRow
            propKey="text"
            def={{ title: "Text", input: "text", group: "Other" }}
            value={overriddenText}
            overridden={overriddenText !== undefined}
            onChange={(next) =>
              void setCvNodeOverride(applicationStore, application.id, current.id, {
                text: String(next),
              })
            }
            onReset={() =>
              void resetCvNodeOverride(applicationStore, application.id, current.id, "text")
            }
          />
        ) : null}
      </div>
    </div>
  )
}
