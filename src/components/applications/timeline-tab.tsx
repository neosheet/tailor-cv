import { HistoryIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { StageCard } from "@/components/applications/stage-card"
import { StageFormDialog } from "@/components/applications/stage-form-dialog"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { stagesForApplication } from "@/lib/application-stage"
import { useApplicationStore } from "@/lib/application-store"
import type { DbApplication } from "@/mocks/types"

/**
 * The Timeline tab's content — a vertical, connected list of `StageCard`s,
 * one per top-level stage, in position order. Calls `useApplicationStore`
 * itself (matching how e.g. `SkillCategoriesPanel` calls `useInventoryStore`
 * itself) rather than having the store prop-drilled in.
 *
 * The connector line/dot rail is hand-composed from `border-l-2
 * border-border` plus a small dot marker per item — there's no existing
 * timeline/stepper primitive in this project's shadcn registry (confirmed
 * during planning), so this is the documented hand-composed fallback rather
 * than a shortcut around checking first.
 */
export function TimelineTab({ application }: { application: DbApplication }) {
  const store = useApplicationStore()
  const { dialog, open, close } = useDialogSearchParams()
  const adding = dialog === "add-stage"

  const stages = stagesForApplication(store, application.id)

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button variant="outline" size="sm" onClick={() => open("add-stage")}>
          <PlusIcon data-icon="inline-start" />
          Add stage
        </Button>
      </div>

      {stages.length === 0 ? (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>No stages yet.</EmptyTitle>
            <EmptyDescription>
              Add the first stage to start tracking this application&apos;s pipeline.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ol className="flex flex-col">
          {stages.map((stage, index) => (
            <li key={stage.id} className="relative flex gap-4 pb-6 last:pb-0">
              <div className="relative flex w-6 shrink-0 justify-center">
                {index < stages.length - 1 ? (
                  <div className="absolute inset-y-0 left-[11px] border-l-2 border-border" />
                ) : null}
                <span className="relative top-1.5 size-2.5 shrink-0 rounded-full bg-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <StageCard stage={stage} application={application} />
              </div>
            </li>
          ))}
        </ol>
      )}

      <StageFormDialog
        mode="add"
        application={application}
        parentStageId={null}
        open={adding}
        onOpenChange={(next) => !next && close()}
        onSaved={() => {}}
      />
    </div>
  )
}
