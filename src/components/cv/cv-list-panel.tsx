import * as React from "react"
import {
  CopyIcon,
  Ellipsis,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react"
import { Link } from "react-router"

import { Badge } from "@/components/ui/badge"
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
import { CvFormDialog } from "@/components/cv/cv-form-dialog"
import { DeleteCvDialog } from "@/components/cv/delete-cv-dialog"
import { cvTemplates } from "@/lib/cv-templates"
import {
  allCvs,
  createCv,
  deleteCv,
  duplicateCv,
  toggleCvFavorite,
  updateCv,
} from "@/lib/cv"
import { allPersonas, findPersona } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbCv } from "@/mocks/types"

/** Saved (Persona, Template) pairings — see docs/specs/06-persona-cv-split.md. */
export function CvListPanel() {
  const store = usePersonaStore()
  const [creating, setCreating] = React.useState(false)
  const [formDialog, setFormDialog] = React.useState<{
    mode: "edit" | "duplicate"
    cv: DbCv
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DbCv | null>(null)

  const rows = allCvs(store).map((cv) => ({
    cv,
    persona: cv.personaId ? findPersona(store, cv.personaId) : undefined,
    template: cvTemplates.find((candidate) => candidate.id === cv.templateId),
  }))

  const personaOptions = allPersonas(store).map((persona) => ({
    value: persona.id,
    label: persona.name,
  }))
  const templateOptions = cvTemplates.map((template) => ({
    value: template.id,
    label: template.name,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
          <PlusIcon data-icon="inline-start" />
          New CV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Name</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ cv, persona, template }) => (
              <TableRow key={cv.id}>
                <TableCell className="align-top">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleCvFavorite(store, cv.id)}
                    aria-pressed={cv.favorite}
                    aria-label={
                      cv.favorite
                        ? `Remove ${cv.name} from favourites`
                        : `Add ${cv.name} to favourites`
                    }
                  >
                    <StarIcon
                      className={
                        cv.favorite ? "fill-current" : "text-muted-foreground/40"
                      }
                    />
                  </Button>
                </TableCell>
                <TableCell className="align-top font-medium whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="link"
                      className="h-auto justify-start p-0 font-medium"
                      render={<Link to={`/cvs/${cv.id}/print`} />}
                      nativeButton={false}
                    >
                      {cv.name}
                    </Button>
                    {cv.snapshot != null ? (
                      <Badge variant="secondary">Imported</Badge>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  {persona?.name ?? "—"}
                </TableCell>
                <TableCell className="align-top whitespace-nowrap">
                  {template?.name ?? "—"}
                </TableCell>
                <TableCell className="align-top whitespace-normal text-muted-foreground">
                  {cv.note ?? "—"}
                </TableCell>
                <TableCell className="align-top">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${cv.name}`}
                        />
                      }
                    >
                      <Ellipsis />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          onClick={() => setFormDialog({ mode: "edit", cv })}
                        >
                          <PencilIcon />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toggleCvFavorite(store, cv.id)}
                        >
                          <StarIcon className={cv.favorite ? "fill-current" : undefined} />
                          {cv.favorite ? "Remove from favourites" : "Favorite"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setFormDialog({ mode: "duplicate", cv })}
                        >
                          <CopyIcon />
                          Duplicate
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(cv)}
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

      <CvFormDialog
        open={creating}
        onOpenChange={setCreating}
        title="New CV"
        confirmLabel="Create"
        personaOptions={personaOptions}
        templateOptions={templateOptions}
        onSubmit={async (fields) => {
          await createCv(store, fields)
        }}
      />

      <CvFormDialog
        open={formDialog !== null}
        onOpenChange={(next) => !next && setFormDialog(null)}
        title={formDialog?.mode === "edit" ? "Edit CV" : "Duplicate CV"}
        confirmLabel={formDialog?.mode === "edit" ? "Save" : "Duplicate"}
        initialName={
          formDialog?.mode === "edit"
            ? formDialog.cv.name
            : `${formDialog?.cv.name ?? ""} (Copy)`
        }
        initialPersonaId={formDialog?.cv.personaId ?? undefined}
        initialTemplateId={formDialog?.cv.templateId ?? undefined}
        initialNote={formDialog?.cv.note ?? null}
        initialTags={formDialog?.cv.tags ?? []}
        personaOptions={personaOptions}
        templateOptions={templateOptions}
        frozen={formDialog?.mode === "edit" && formDialog.cv.snapshot != null}
        onSubmit={async (fields) => {
          if (!formDialog) return
          if (formDialog.mode === "edit") {
            await updateCv(store, formDialog.cv.id, fields)
          } else {
            await duplicateCv(store, formDialog.cv.id, fields)
          }
        }}
        onSubmitFrozen={async (fields) => {
          if (!formDialog) return
          await updateCv(store, formDialog.cv.id, fields)
        }}
      />

      <DeleteCvDialog
        cv={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteCv(store, deleteTarget.id)
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
