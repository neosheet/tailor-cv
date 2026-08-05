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
import { PageHeader } from "@/components/layout/page-header"
import { allCvs, buildResumeDocument } from "@/mocks/cv"
import { sections } from "@/lib/navigation"

export function CvsPage() {
  const rows = allCvs().map((cv) => {
    const document = buildResumeDocument(cv.id)
    const entries = document.sections.reduce(
      (total, section) => total + section.entries.length,
      0
    )
    return { cv, document, entries }
  })

  return (
    <>
      <PageHeader
        title={sections.cvs.title}
        description={sections.cvs.description}
        action={
          <Button variant="outline" size="sm" disabled>
            <PlusIcon data-icon="inline-start" />
            New CV
          </Button>
        }
      />

      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Headline</TableHead>
              <TableHead>Sections</TableHead>
              <TableHead>Entries</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ cv, document, entries }) => (
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
                  {cv.note ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
