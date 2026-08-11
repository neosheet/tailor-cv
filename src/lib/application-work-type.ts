import type { ApplicationWorkType } from "@/mocks/types"

/** Human labels for every `ApplicationWorkType` — mirrors `application-status.ts`. */
export const WORK_TYPE_LABEL: Record<ApplicationWorkType, string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  on_site: "On-site",
}

/** Declaration order for the Select's options. */
export const APPLICATION_WORK_TYPES: ApplicationWorkType[] = [
  "remote",
  "hybrid",
  "on_site",
]
