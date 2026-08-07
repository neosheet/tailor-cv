import { PlusIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cvTemplates } from "@/lib/cv-templates"
import { allCvs } from "@/lib/cv"
import { findPersona } from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"

/** Saved (Persona, Template) pairings — see docs/specs/06-persona-cv-split.md. */
export function CvListPanel() {
  const store = usePersonaStore()
  const rows = allCvs(store).map((cv) => ({
    cv,
    persona: findPersona(store, cv.personaId),
    template: cvTemplates.find((candidate) => candidate.id === cv.templateId),
  }))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" disabled>
          <PlusIcon data-icon="inline-start" />
          New CV
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Persona</TableHead>
              <TableHead>Template</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ cv, persona, template }) => (
              <TableRow key={cv.id}>
                <TableCell className="align-top font-medium whitespace-nowrap">
                  <Button
                    variant="link"
                    className="h-auto justify-start p-0 font-medium"
                    render={<Link to={`/cvs/${cv.id}/print`} />}
                    nativeButton={false}
                  >
                    {cv.name}
                  </Button>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
