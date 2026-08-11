import * as React from "react"
import { Ellipsis, PencilIcon, PlusIcon, StarIcon, Trash2Icon } from "lucide-react"
import { format, parseISO } from "date-fns"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { StageFormDialog } from "@/components/applications/stage-form-dialog"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { deleteStage, setCurrentStage } from "@/lib/application-stage"
import type { StageNode } from "@/lib/application-stage"
import { useApplicationStore } from "@/lib/application-store"
import { stageCategoryLabel } from "@/lib/stage-category"
import {
  STAGE_PROGRESS_STATUS_LABEL,
  STAGE_STATUS_BADGE_VARIANT,
} from "@/lib/stage-progress-status"
import type { DbApplication, DbApplicationStage } from "@/mocks/types"

function formatStageDate(value: string | null): string | null {
  return value ? format(parseISO(value), "PP") : null
}

/**
 * Scheduled/Completed dates, Notes, Interviewers — only rendered when the
 * underlying stage actually has a value for them. `null` if none apply, so
 * the caller can skip the wrapping gap entirely.
 */
function StageMetaRows({ stage }: { stage: DbApplicationStage }) {
  const scheduled = formatStageDate(stage.scheduledAt)
  const completed = formatStageDate(stage.completedAt)

  if (!scheduled && !completed && !stage.notes && stage.interviewerNames.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      {scheduled ? <p>Scheduled: {scheduled}</p> : null}
      {completed ? <p>Completed: {completed}</p> : null}
      {stage.notes ? <p className="whitespace-pre-wrap">{stage.notes}</p> : null}
      {stage.interviewerNames.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {stage.interviewerNames.map((name) => (
            <Badge key={name} variant="secondary">
              {name}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

/**
 * One compact sub-stage row nested under its parent `StageCard`. Only
 * Edit/Delete on its menu — no "Add sub-stage", no "Mark as current" — which
 * is what visually enforces the depth-1 rule already enforced in
 * `createStage` (a sub-stage can't itself have children).
 */
function SubStageRow({ stage }: { stage: DbApplicationStage }) {
  const store = useApplicationStore()
  const { dialog, get, open, close } = useDialogSearchParams()
  const editing = dialog === "edit-substage" && get("stageId") === stage.id
  const deleting = dialog === "delete-stage" && get("stageId") === stage.id
  const [busy, setBusy] = React.useState(false)

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteStage(store, stage.id)
      close(["stageId"])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{stage.name}</span>
        <Badge variant="outline">{stageCategoryLabel(stage.category)}</Badge>
        <Badge variant={STAGE_STATUS_BADGE_VARIANT[stage.status]}>
          {STAGE_PROGRESS_STATUS_LABEL[stage.status]}
        </Badge>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${stage.name}`} />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-40">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => open("edit-substage", { stageId: stage.id })}>
              <PencilIcon />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => open("delete-stage", { stageId: stage.id })}
            >
              <Trash2Icon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <StageFormDialog
        mode="edit"
        stage={stage}
        open={editing}
        onOpenChange={(next) => !next && close(["stageId"])}
        onSaved={() => {}}
      />

      <AlertDialog open={deleting} onOpenChange={(next) => !busy && !next && close(["stageId"])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{stage.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the sub-stage permanently. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(["stageId"])}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * One top-level stage in an application's Timeline tab, plus its (depth-1)
 * sub-stages nested underneath. Mirrors `application-list-panel.tsx`'s
 * row-action `DropdownMenu` pattern (`Ellipsis` trigger) and
 * `application-detail-view.tsx`'s inline `AlertDialog` confirmation pattern
 * (the freeze-confirmation one) — both reused here rather than reinvented.
 */
export function StageCard({ stage, application }: { stage: StageNode; application: DbApplication }) {
  const store = useApplicationStore()
  const { dialog, get, open, close } = useDialogSearchParams()
  const editing = dialog === "edit-stage" && get("stageId") === stage.id
  const addingSubStage = dialog === "add-substage" && get("stageId") === stage.id
  const deleting = dialog === "delete-stage" && get("stageId") === stage.id
  const [busy, setBusy] = React.useState(false)

  const isCurrent = application.currentStageId === stage.id

  async function confirmDelete() {
    setBusy(true)
    try {
      await deleteStage(store, stage.id)
      close(["stageId"])
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{stage.name}</span>
            <Badge variant="outline">{stageCategoryLabel(stage.category)}</Badge>
            <Badge variant={STAGE_STATUS_BADGE_VARIANT[stage.status]}>
              {STAGE_PROGRESS_STATUS_LABEL[stage.status]}
            </Badge>
            {isCurrent ? <Badge variant="default">Current</Badge> : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${stage.name}`} />
              }
            >
              <Ellipsis />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => open("edit-stage", { stageId: stage.id })}>
                  <PencilIcon />
                  Edit
                </DropdownMenuItem>
                {!isCurrent ? (
                  <DropdownMenuItem
                    onClick={() => {
                      void setCurrentStage(store, application.id, stage.id)
                    }}
                  >
                    <StarIcon />
                    Mark as current
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => open("add-substage", { stageId: stage.id })}>
                  <PlusIcon />
                  Add sub-stage
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => open("delete-stage", { stageId: stage.id })}
                >
                  <Trash2Icon />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <StageMetaRows stage={stage} />

        {stage.subStages.length > 0 ? (
          <div className="ml-2 flex flex-col gap-2 border-l-2 border-border pl-4">
            {stage.subStages.map((subStage) => (
              <SubStageRow key={subStage.id} stage={subStage} />
            ))}
          </div>
        ) : null}
      </CardContent>

      <StageFormDialog
        mode="edit"
        stage={stage}
        open={editing}
        onOpenChange={(next) => !next && close(["stageId"])}
        onSaved={() => {}}
      />
      <StageFormDialog
        mode="add"
        application={application}
        parentStageId={stage.id}
        open={addingSubStage}
        onOpenChange={(next) => !next && close(["stageId"])}
        onSaved={() => {}}
      />

      <AlertDialog open={deleting} onOpenChange={(next) => !busy && !next && close(["stageId"])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete &ldquo;{stage.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the stage{stage.subStages.length > 0 ? " and its sub-stages" : ""}{" "}
              permanently. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(["stageId"])}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={confirmDelete}>
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
