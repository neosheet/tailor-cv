import type { GlobalApplicationStatus } from "@/mocks/types"

export const GLOBAL_STATUS_LABEL: Record<GlobalApplicationStatus, string> = {
  draft: "Draft",
  applied: "Applied",
  in_progress: "In Progress",
  offered: "Offered",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export const GLOBAL_APPLICATION_STATUSES: GlobalApplicationStatus[] = [
  "draft",
  "applied",
  "in_progress",
  "offered",
  "rejected",
  "withdrawn",
]
