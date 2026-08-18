import * as React from "react"
import { ListChecksIcon, TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DuplicateApplicationsList } from "@/components/applications/similar-applications-dialog"
import { checkApplication, resolveApplicationCv, type ApplicationCheckResult } from "@/lib/application"
import { useApplicationStore } from "@/lib/application-store"
import { useInventoryStore } from "@/lib/inventory-store"
import { usePersonaStore } from "@/lib/persona-store"
import type { DbApplication } from "@/mocks/types"

/**
 * Top-of-page "Check" button — runs `checkApplication`'s three on-demand
 * checks (duplicate Company, missing skills against the saved required-
 * skills input, position vs. attached CV headline) and shows them together
 * in one dialog. Self-contained — reads its own stores and owns its own
 * dialog state — so it drops into both the drawer header
 * (`ApplicationDetailView`) and the full-page header
 * (`ApplicationDetailPage`) without prop drilling.
 */
export function ApplicationCheckButton({ application }: { application: DbApplication }) {
  const applicationStore = useApplicationStore()
  const personaStore = usePersonaStore()
  const inventoryStore = useInventoryStore()

  const [result, setResult] = React.useState<ApplicationCheckResult | null>(null)

  function runCheck() {
    const resolvedCv = resolveApplicationCv(application, personaStore, inventoryStore)
    setResult(checkApplication(applicationStore, application, resolvedCv))
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={runCheck}>
        <ListChecksIcon data-icon="inline-start" />
        Check
      </Button>

      <Dialog open={result !== null} onOpenChange={(next) => !next && setResult(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Application check</DialogTitle>
            <DialogDescription>
              Duplicate, skills, and position checks for this application.
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <DialogBody className="flex flex-col gap-5">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Duplicates</h3>
                {result.duplicates.length > 0 ? (
                  <DuplicateApplicationsList applications={result.duplicates} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No other applications share this company.
                  </p>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Skills</h3>
                {result.skills.status === "no-cv" ? (
                  <p className="text-sm text-muted-foreground">
                    No CV attached — can&apos;t check skills.
                  </p>
                ) : result.skills.status === "no-required-skills" ? (
                  <p className="text-sm text-muted-foreground">
                    No required skills saved yet — use Check skills to add some.
                  </p>
                ) : result.skills.missing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All covered — nothing missing.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {result.skills.missing.map((skill) => (
                      <Badge key={skill} variant="destructive">
                        <TriangleAlert data-icon="inline-start" />
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">Position vs. CV headline</h3>
                {result.headline.status === "no-cv" ? (
                  <p className="text-sm text-muted-foreground">
                    No CV attached — can&apos;t compare.
                  </p>
                ) : result.headline.status === "no-headline" ? (
                  <p className="text-sm text-muted-foreground">
                    The attached CV has no headline set.
                  </p>
                ) : result.headline.status === "no-position" ? (
                  <p className="text-sm text-muted-foreground">
                    No position set on this application.
                  </p>
                ) : result.headline.status === "match" ? (
                  <Badge variant="secondary">Matches the CV headline</Badge>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Position &quot;{result.headline.position}&quot; doesn&apos;t match the CV
                    headline &quot;{result.headline.headline}&quot;.
                  </p>
                )}
              </section>
            </DialogBody>
          ) : null}

          <DialogFooter>
            <Button size="sm" onClick={() => setResult(null)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
