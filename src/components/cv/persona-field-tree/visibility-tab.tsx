import * as React from "react"

import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import {
  BASICS_KINDS,
  KIND_ICON,
  LeafRow,
  ParentRow,
  type Reorder,
} from "@/components/cv/persona-field-tree/shared"
import { setFieldHidden, setKindHidden } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import {
  FIELD_REGISTRY,
  hiddenFieldsOf,
  isKindHidden,
  orderedSectionKinds,
  reorderPersonaSections,
  titleFor,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication, ItemKind } from "@/mocks/types"

/** One kind — Basics field or Section — as a tree row. Expands into field rows when the kind has more than one togglable field. */
function KindRow({
  application,
  kind,
  hidden,
  hiddenFields,
  reorder,
}: {
  application: DbApplication
  kind: ItemKind
  hidden: boolean
  hiddenFields: Set<string>
  reorder?: Reorder
}) {
  const applicationStore = useApplicationStore()
  const [open, setOpen] = React.useState(false)

  const label = titleFor(kind)
  const fields = FIELD_REGISTRY[kind]

  const row = (
    <ParentRow
      icon={KIND_ICON[kind]}
      label={label}
      hidden={hidden}
      open={open}
      expandable={Boolean(fields)}
      onToggleHidden={() =>
        void setKindHidden(applicationStore, application.id, kind, !hidden)
      }
      reorder={reorder}
    />
  )

  if (!fields) {
    return row
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {row}
      <CollapsibleContent>
        {fields.map((field) => (
          <LeafRow
            key={field.key}
            label={field.label}
            hidden={hiddenFields.has(field.key)}
            onToggle={() =>
              void setFieldHidden(
                applicationStore,
                application.id,
                kind,
                field.key,
                !hiddenFields.has(field.key)
              )
            }
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export function VisibilityTab({ application }: { application: DbApplication }) {
  const personaStore = usePersonaStore()
  if (!application.cvPersonaId) {
    return null
  }
  const personaId = application.cvPersonaId
  const persona = personaStore.personas.find((row) => row.id === personaId)
  if (!persona) {
    return null
  }

  const fieldVisibility = application.cvPersonaSettings.fieldVisibility ?? {}
  const sectionOrder = orderedSectionKinds(personaStore, personaId)

  return (
    <>
      <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Basics
      </p>
      <div className="flex flex-col">
        {BASICS_KINDS.map((kind) => (
          <KindRow
            key={kind}
            application={application}
            kind={kind}
            hidden={isKindHidden(fieldVisibility, kind)}
            hiddenFields={hiddenFieldsOf(fieldVisibility, kind)}
          />
        ))}
      </div>

      <Separator className="my-2" />

      <p className="px-2 pt-1 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Sections
      </p>
      <div className="flex flex-col">
        {sectionOrder.map((kind, index) => (
          <KindRow
            key={kind}
            application={application}
            kind={kind}
            hidden={isKindHidden(fieldVisibility, kind)}
            hiddenFields={hiddenFieldsOf(fieldVisibility, kind)}
            reorder={{
              canMoveUp: index > 0,
              canMoveDown: index < sectionOrder.length - 1,
              onMoveUp: () => {
                const next = [...sectionOrder]
                ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                void reorderPersonaSections(personaStore, personaId, next)
              },
              onMoveDown: () => {
                const next = [...sectionOrder]
                ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
                void reorderPersonaSections(personaStore, personaId, next)
              },
            }}
          />
        ))}
      </div>
    </>
  )
}
