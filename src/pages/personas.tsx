import * as React from "react"
import {
  CopyIcon,
  Ellipsis,
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
import { DeletePersonaDialog } from "@/components/persona/delete-persona-dialog"
import { PersonaFormDialog } from "@/components/persona/persona-form-dialog"
import { useInventoryStore } from "@/lib/inventory-store"
import {
  allPersonas,
  buildResumeDocument,
  createPersona,
  deletePersona,
  duplicatePersona,
  togglePersonaFavorite,
  updatePersona,
  type DbPersona,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { sections } from "@/lib/navigation"

export function PersonasPage() {
  const inventoryStore = useInventoryStore()
  const personaStore = usePersonaStore()
  const navigate = useNavigate()
  const [creating, setCreating] = React.useState(false)
  const [formDialog, setFormDialog] = React.useState<{
    mode: "edit" | "duplicate"
    persona: DbPersona
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DbPersona | null>(null)

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
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
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
                          onClick={() =>
                            setFormDialog({ mode: "edit", persona })
                          }
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
                          onClick={() =>
                            setFormDialog({ mode: "duplicate", persona })
                          }
                        >
                          <CopyIcon />
                          Duplicate
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(persona)}
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
        open={creating}
        onOpenChange={setCreating}
        title="New Persona"
        confirmLabel="Create"
        onSubmit={async (fields) => {
          const persona = await createPersona(personaStore, fields)
          navigate(`/personas/${persona.id}`)
        }}
      />

      <PersonaFormDialog
        open={formDialog !== null}
        onOpenChange={(next) => !next && setFormDialog(null)}
        title={formDialog?.mode === "edit" ? "Edit Persona" : "Duplicate Persona"}
        confirmLabel={formDialog?.mode === "edit" ? "Save" : "Duplicate"}
        initialName={
          formDialog?.mode === "edit"
            ? formDialog.persona.name
            : `${formDialog?.persona.name ?? ""} (Copy)`
        }
        initialNote={formDialog?.persona.note ?? null}
        initialTags={formDialog?.persona.tags ?? []}
        onSubmit={async (fields) => {
          if (!formDialog) return
          if (formDialog.mode === "edit") {
            await updatePersona(personaStore, formDialog.persona.id, fields)
          } else {
            const persona = await duplicatePersona(
              personaStore,
              formDialog.persona.id,
              fields
            )
            navigate(`/personas/${persona.id}`)
          }
        }}
      />

      <DeletePersonaDialog
        persona={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deletePersona(personaStore, deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
