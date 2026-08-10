import type { BuiltInStageCategory } from "@/mocks/types"

export const BUILT_IN_STAGE_CATEGORIES: BuiltInStageCategory[] = [
  "recruiter_screen",
  "technical_interview",
  "system_design",
  "behavioral",
  "take_home_assignment",
  "portfolio_review",
  "performance_audition",
  "onsite_loop",
  "executive_chat",
  "offer_negotiation",
  "custom",
]

export const STAGE_CATEGORY_LABEL: Record<BuiltInStageCategory, string> = {
  recruiter_screen: "Recruiter Screen",
  technical_interview: "Technical Interview",
  system_design: "System Design",
  behavioral: "Behavioral",
  take_home_assignment: "Take-Home Assignment",
  portfolio_review: "Portfolio Review",
  performance_audition: "Performance Audition",
  onsite_loop: "Onsite Loop",
  executive_chat: "Executive Chat",
  offer_negotiation: "Offer Negotiation",
  custom: "Custom",
}

/**
 * `category` is `BuiltInStageCategory | string` end-to-end (the DB column is
 * plain `text`) — falls back to the raw value for anything outside the fixed
 * 11 this app's own UI ever writes (e.g. hand-edited data).
 */
export function stageCategoryLabel(category: string): string {
  return STAGE_CATEGORY_LABEL[category as BuiltInStageCategory] ?? category
}
