import { useState } from "react"

import { findMissingSkills } from "@/lib/skill-check"

/**
 * Shared `value`/`result`/`onCheck` state for a `SkillsCheckDialog` caller.
 * Persistence (if any) and dialog open/close stay with the caller — this only
 * dedupes the state trio that was previously hand-copied at each call site.
 * `availableSkills` is taken at `onCheck` call time rather than as a hook
 * argument, so callers whose skills list is only known after an early-return
 * guard (e.g. Persona detail, gated on the persona existing) can still call
 * this hook unconditionally, as React's rules require.
 * `reset` is for callers that need to re-seed from persisted data on open
 * (Applications); ephemeral callers (CV, Persona) simply never call it.
 */
export function useSkillsCheck() {
  const [value, setValue] = useState("")
  const [result, setResult] = useState<string[] | null>(null)

  function onCheck(availableSkills: string[]) {
    setResult(findMissingSkills(value, availableSkills))
  }

  function reset(nextValue: string, nextResult: string[] | null) {
    setValue(nextValue)
    setResult(nextResult)
  }

  return { value, setValue, result, onCheck, reset }
}
