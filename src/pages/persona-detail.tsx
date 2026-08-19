import { ArrowLeftIcon, UsersIcon } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { PersonaEditorPanel } from "@/components/persona/persona-editor-panel"
import { findPersona } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"

/**
 * Route wrapper for `/personas/:id`. Page-level chrome only (Back button,
 * not-found guard) — the actual editor content lives in `PersonaEditorPanel`,
 * shared with embedded popups (see
 * docs/specs/16-inline-persona-editing-in-cv-tab.md).
 */
export function PersonaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const personaStore = usePersonaStore()

  const persona = id ? findPersona(personaStore, id) : undefined

  if (!persona) {
    return (
      <Empty className="min-h-72 flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>No such Persona</EmptyTitle>
          <EmptyDescription>
            That Persona doesn&apos;t exist, or it has been deleted.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            render={<Link to="/personas" />}
            nativeButton={false}
          >
            Back to Personas
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link to="/personas" />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Personas
      </Button>

      <PersonaEditorPanel
        personaId={persona.id}
        onDuplicated={(p) => navigate(`/personas/${p.id}`)}
      />
    </div>
  )
}
