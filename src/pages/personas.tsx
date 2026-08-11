import {
  CopyIcon,
  Ellipsis,
  FilePlusIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { Link, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/layout/page-header"
import { CvFormDialog } from "@/components/cv/cv-form-dialog"
import { DeletePersonaDialog } from "@/components/persona/delete-persona-dialog"
import { PersonaFormDialog } from "@/components/persona/persona-form-dialog"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { createCv } from "@/lib/cv"
import { cvTemplates } from "@/lib/cv-templates"
import { useInventoryStore } from "@/lib/inventory-store"
import {
  allPersonas,
  buildResumeDocument,
  createPersona,
  deletePersona,
  duplicatePersona,
  findPersona,
  togglePersonaFavorite,
  updatePersona,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { sections } from "@/lib/navigation"

export function PersonasPage() {
  const inventoryStore = useInventoryStore()
  const personaStore = usePersonaStore()
  const navigate = useNavigate()
  const { dialog, get, open, close } = useDialogSearchParams()

  const formDialogMode =
    dialog === "edit" || dialog === "duplicate" ? dialog : null
  const formDialogId = get("id")
  const formDialogPersona = formDialogId
    ? (findPersona(personaStore, formDialogId) ?? null)
    : null

  const deleteTargetId = dialog === "delete" ? get("id") : null
  const deleteTarget = deleteTargetId
    ? (findPersona(personaStore, deleteTargetId) ?? null)
    : null

  const createCvForId = dialog === "new-cv" ? get("personaId") : null
  const createCvFor = createCvForId
    ? (findPersona(personaStore, createCvForId) ?? null)
    : null

  const personaOptions = allPersonas(personaStore).map((persona) => ({
    value: persona.id,
    label: persona.name,
  }))
  const templateOptions = cvTemplates.map((template) => ({
    value: template.id,
    label: template.name,
  }))

  const rows = allPersonas(personaStore).map((persona) => {
    const document = buildResumeDocument(personaStore, inventoryStore, persona.id)
    const entries = document.sections.reduce(
      (total, section) => total + section.entries.length,
      0
    )
    return { persona, document, entries }
  })

  return (
    <>
      <PageHeader
        title={sections.personas.title}
        description={sections.personas.description}
        action={
          <Button variant="outline" size="sm" onClick={() => open("new")}>
            <PlusIcon data-icon="inline-start" />
            New Persona
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead>Headline</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ persona, document, entries }) => (
              <TableRow key={persona.id}>
                <TableCell className="align-top">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => togglePersonaFavorite(personaStore, persona.id)}
                    aria-pressed={persona.favorite}
                    aria-label={
                      persona.favorite
                        ? `Remove ${persona.name} from favourites`
                        : `Add ${persona.name} to favourites`
                    }
                  >
                    <StarIcon
                      className={
                        persona.favorite
                          ? "fill-current"
                          : "text-muted-foreground/40"
                      }
                    />
                  </Button>
                </TableCell>
                <TableCell className="align-top font-medium whitespace-nowrap">
                  <Button
                    variant="link"
                    className="h-auto justify-start p-0 font-medium"
                    render={<Link to={`/personas/${persona.id}`} />}
                    nativeButton={false}
                  >
                    {persona.name}
                  </Button>
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  {document.headline ?? "—"}
                </TableCell>
                <TableCell className="align-top tabular-nums">
                  {document.sections.length}
                </TableCell>
                <TableCell className="align-top tabular-nums">
                  {entries}
                </TableCell>
                <TableCell className="align-top whitespace-normal text-muted-foreground">
                  {persona.note ?? "—"}
                </TableCell>
                <TableCell className="align-top">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${persona.name}`}
                        />
                      }
                    >
                      <Ellipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => open("edit", { id: persona.id })}
                        >
                          <PencilIcon />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            togglePersonaFavorite(personaStore, persona.id)
                          }
                        >
                          <StarIcon
                            className={
                              persona.favorite ? "fill-current" : undefined
                            }
                          />
                          {persona.favorite
                            ? "Remove from favourites"
                            : "Favorite"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => open("duplicate", { id: persona.id })}
                        >
                          <CopyIcon />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() =>
                            open("new-cv", { personaId: persona.id })
                          }
                        >
                          <FilePlusIcon />
                          Create CV
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => open("delete", { id: persona.id })}
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PersonaFormDialog
        open={dialog === "new"}
        onOpenChange={(next) => !next && close()}
        title="New Persona"
        confirmLabel="Create"
        onSubmit={async (fields) => {
          const persona = await createPersona(personaStore, fields)
          navigate(`/personas/${persona.id}`)
        }}
      />

      <PersonaFormDialog
        open={formDialogMode !== null}
        onOpenChange={(next) => !next && close(["id"])}
        title={formDialogMode === "edit" ? "Edit Persona" : "Duplicate Persona"}
        confirmLabel={formDialogMode === "edit" ? "Save" : "Duplicate"}
        initialName={
          formDialogMode === "edit"
            ? (formDialogPersona?.name ?? "")
            : `${formDialogPersona?.name ?? ""} (Copy)`
        }
        initialNote={formDialogPersona?.note ?? null}
        initialTags={formDialogPersona?.tags ?? []}
        onSubmit={async (fields) => {
          if (!formDialogPersona || !formDialogMode) return
          if (formDialogMode === "edit") {
            await updatePersona(personaStore, formDialogPersona.id, fields)
          } else {
            const persona = await duplicatePersona(
              personaStore,
              formDialogPersona.id,
              fields
            )
            navigate(`/personas/${persona.id}`)
          }
        }}
      />

      <DeletePersonaDialog
        persona={deleteTarget}
        onCancel={() => close(["id"])}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deletePersona(personaStore, deleteTarget.id)
          close(["id"])
        }}
      />

      <CvFormDialog
        open={createCvFor !== null}
        onOpenChange={(next) => !next && close(["personaId"])}
        title="Create CV"
        confirmLabel="Create"
        initialName={createCvFor?.name ?? ""}
        initialPersonaId={createCvFor?.id}
        personaOptions={personaOptions}
        templateOptions={templateOptions}
        onSubmit={async (fields) => {
          const cv = await createCv(personaStore, fields)
          navigate(`/cvs/${cv.id}/print`)
        }}
      />
    </>
  )
}
