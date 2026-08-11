import type { ApplicationJobType } from "@/mocks/types"

/** Human labels for every `ApplicationJobType` — mirrors `application-status.ts`. */
export const JOB_TYPE_LABEL: Record<ApplicationJobType, string> = {
  full_time: "Full-time",
  freelance: "Freelance",
  contract: "Contract",
}

/** Declaration order for the Select's options. */
export const APPLICATION_JOB_TYPES: ApplicationJobType[] = [
  "full_time",
  "freelance",
  "contract",
]
