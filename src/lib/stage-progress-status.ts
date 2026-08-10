import type { StageProgressStatus } from "@/mocks/types"

export const STAGE_PROGRESS_STATUSES: StageProgressStatus[] = [
  "not_started",
  "invited",
  "scheduled",
  "submitted",
  "under_review",
  "completed",
  "passed",
  "failed",
  "skipped",
]

export const STAGE_PROGRESS_STATUS_LABEL: Record<StageProgressStatus, string> = {
  not_started: "Not Started",
  invited: "Invited",
  scheduled: "Scheduled",
  submitted: "Submitted",
  completed: "Completed",
  under_review: "Under Review",
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
}

/** Keeps status color-coding to existing `Badge` variants — no raw colors. */
export const STAGE_STATUS_BADGE_VARIANT: Record<
  StageProgressStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_started: "outline",
  invited: "secondary",
  scheduled: "secondary",
  submitted: "secondary",
  under_review: "secondary",
  completed: "secondary",
  passed: "default",
  failed: "destructive",
  skipped: "outline",
}
