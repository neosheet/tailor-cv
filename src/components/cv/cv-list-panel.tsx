import * as React from "react"
import {
  CopyIcon,
  Ellipsis,
  FileDownIcon,
  FileUpIcon,
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
import { allTemplates, findTemplate } from "@/lib/cv-templates"
import {
  allCvs,
  createCv,
  deleteCv,
  duplicateCv,
  importCvSnapshot,
  resolveCv,
  toggleCvFavorite,
  updateCv,
} from "@/lib/cv"
import { buildCvSnapshot, parseCvSnapshot } from "@/lib/cv-snapshot"
import { downloadCvSnapshot } from "@/lib/cv-snapshot-download"
import { useInventoryStore } from "@/lib/inventory-store"
import { allPersonas, findPersona } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import type { DbCv } from "@/mocks/types"

/** Saved (Persona, Template) pairings — see docs/specs/06-persona-cv-split.md. */
export function CvListPanel() {
  const store = usePersonaStore()
  const inventoryStore = useInventoryStore()
  const { dialog, get, open, close } = useDialogSearchParams()
  const [importError, setImportError] = React.useState<string | null>(null)
  const importInputRef = React.useRef<HTMLInputElement>(null)

  const handleExport = (cv: DbCv) => {
    const resolved = resolveCv(store, inventoryStore, cv.id)
    if (!resolved) return
    downloadCvSnapshot(buildCvSnapshot(resolved.cv, resolved.document, resolved.template))
  }

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    try {
      const text = await file.text()
      const snapshot = parseCvSnapshot(JSON.parse(text))
      await importCvSnapshot(store, snapshot)
      setImportError(null)
    } catch (caught) {
      setImportError(caught instanceof Error ? caught.message : String(caught))
    }
  }

  const rows = allCvs(store).map((cv) => ({
    cv,
    persona: cv.personaId ? findPersona(store, cv.personaId) : undefined,
    template: findTemplate(cv.templateId ?? "", store.cvTemplates),
  }))

  const formDialog =
    dialog === "edit" || dialog === "duplicate"
      ? (() => {
          const cv = rows.find((row) => row.cv.id === get("id"))?.cv
          return cv ? { mode: dialog, cv } : null
        })()
      : null
  const deleteTarget =
    dialog === "delete"
      ? (rows.find((row) => row.cv.id === get("id"))?.cv ?? null)
      : null

  const personaOptions = allPersonas(store).map((persona) => ({
    value: persona.id,
    label: persona.name,
  }))
  const templateOptions = allTemplates(store.cvTemplates).map((template) => ({
    value: template.id,
    label: template.name,
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-end gap-2">
        <div className="flex justify-end gap-2">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFileChange}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => importInputRef.current?.click()}
          >
            <FileUpIcon data-icon="inline-start" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={() => open("new")}>
            <PlusIcon data-icon="inline-start" />
            New CV
          </Button>
        </div>
        {importError ? (
          <p className="text-sm text-destructive">{importError}</p>
        ) : null}
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
                          onClick={() => open("edit", { id: cv.id })}
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
                          onClick={() => open("duplicate", { id: cv.id })}
                        >
                          <CopyIcon />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport(cv)}>
                          <FileDownIcon />
                          Export
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => open("delete", { id: cv.id })}
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
        open={dialog === "new"}
        onOpenChange={(next) => !next && close()}
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
        onOpenChange={(next) => !next && close(["id"])}
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
        onCancel={() => close(["id"])}
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteCv(store, deleteTarget.id)
          close(["id"])
        }}
      />
    </div>
  )
}
