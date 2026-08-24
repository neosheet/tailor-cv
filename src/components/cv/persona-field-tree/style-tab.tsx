import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PropertyRow } from "@/components/cv/persona-field-tree/shared"
import { resetCvStyleProperty, setCvStyleProperty } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { resolveStyleObject } from "@/lib/cv-template-core"
import type { CvTemplate } from "@/lib/cv-templates"
import {
  defaultStyleValue,
  humanize,
  STYLE_GROUP_ORDER,
  STYLE_PROPERTY_SCHEMA,
  stylePropertyDef,
  type StyleGroup,
} from "@/lib/style-property-schema"
import type { DbApplication } from "@/mocks/types"

/** The "+ Add property" row — only offers keys not already on the style. */
function AddStyleProperty({
  present,
  onAdd,
}: {
  present: Set<string>
  onAdd: (key: string) => void
}) {
  const [key, setKey] = React.useState("")
  const options = Object.keys(STYLE_PROPERTY_SCHEMA)
    .filter((k) => !present.has(k))
    .map((k) => ({ value: k, label: STYLE_PROPERTY_SCHEMA[k].title }))

  if (options.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 px-2 pt-2">
      <Select items={options} value={key} onValueChange={(next) => setKey(next as string)}>
        <SelectTrigger size="sm" className="h-7 flex-1 text-xs">
          <SelectValue placeholder="+ Add property…" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={!key}
        onClick={() => {
          onAdd(key)
          setKey("")
        }}
      >
        Add
      </Button>
    </div>
  )
}

export function StyleTab({
  application,
  template,
}: {
  application: DbApplication
  template: CvTemplate
}) {
  const applicationStore = useApplicationStore()
  const styleNames = Object.keys(template.definition.styles)
  const [selected, setSelected] = React.useState(styleNames[0] ?? "")

  if (styleNames.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        This template defines no editable styles.
      </p>
    )
  }

  const cur = styleNames.includes(selected) ? selected : styleNames[0]
  const baseStyle = resolveStyleObject(cur, template.definition.styles, undefined, undefined)
  const override = application.cvTemplateSettings.styles?.[cur] ?? {}
  const effective: Record<string, string | number> = { ...baseStyle, ...override }
  const keys = Object.keys(effective)

  const grouped: Partial<Record<StyleGroup, string[]>> = {}
  for (const propKey of keys) {
    const group = stylePropertyDef(propKey, effective[propKey]).group
    ;(grouped[group] ??= []).push(propKey)
  }

  const styleMeta = template.definition.stylesSchema
  const styleOptions = styleNames.map((name) => ({
    value: name,
    label: styleMeta?.[name]?.title ?? humanize(name),
  }))
  const curDescription = styleMeta?.[cur]?.description

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1 px-2">
        <span className="text-xs font-medium text-muted-foreground">Style</span>
        <Select items={styleOptions} value={cur} onValueChange={(next) => setSelected(next as string)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {styleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {curDescription ? (
          <p className="text-xs text-muted-foreground">{curDescription}</p>
        ) : null}
      </div>

      {keys.length === 0 ? (
        <p className="px-2 text-sm text-muted-foreground">No properties on this style.</p>
      ) : null}

      {STYLE_GROUP_ORDER.filter((group) => grouped[group]).map((group) => (
        <div key={group}>
          <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {group}
          </p>
          <div className="flex flex-col px-2">
            {grouped[group]!.map((propKey) => (
              <PropertyRow
                key={propKey}
                propKey={propKey}
                def={stylePropertyDef(propKey, effective[propKey])}
                value={effective[propKey]}
                overridden={propKey in override}
                onChange={(next) =>
                  void setCvStyleProperty(applicationStore, application.id, cur, propKey, next)
                }
                onReset={() =>
                  void resetCvStyleProperty(applicationStore, application.id, cur, propKey)
                }
              />
            ))}
          </div>
        </div>
      ))}

      <AddStyleProperty
        present={new Set(keys)}
        onAdd={(propKey) =>
          void setCvStyleProperty(
            applicationStore,
            application.id,
            cur,
            propKey,
            defaultStyleValue(propKey)
          )
        }
      />
    </div>
  )
}
