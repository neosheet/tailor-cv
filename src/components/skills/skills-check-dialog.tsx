import * as React from "react"
import { TriangleAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"

/**
 * Reusable "paste required skills, see what's missing" dialog — controlled,
 * and deliberately unaware of persistence. Callers own `value`/`result` and
 * decide what `onCheck` does with them (compute-and-persist for Applications,
 * compute-only elsewhere); `extraFooter` is where a caller-specific Save
 * button goes, kept out of this component so it stays generic. See
 * docs/specs/14-missing-skills-check.md.
 */
export function SkillsCheckDialog({
  open,
  onOpenChange,
  value,
  onValueChange,
  result,
  onCheck,
  extraFooter,
  disabledReason,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onValueChange: (value: string) => void
  result: string[] | null
  onCheck: () => void
  extraFooter?: React.ReactNode
  disabledReason?: string
}) {
  const disabled = disabledReason !== undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Check missing skills</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4 pt-2">
          <Field>
            <FieldLabel htmlFor="skills-check-input" className="sr-only">
              Required skills
            </FieldLabel>
            <Textarea
              id="skills-check-input"
              placeholder="Paste required skills, one per line"
              rows={6}
              disabled={disabled}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </Field>

          {disabled ? (
            <p className="text-sm text-muted-foreground">{disabledReason}</p>
          ) : (
            <>
              <Button
                size="sm"
                className="self-start"
                disabled={value.trim() === ""}
                onClick={onCheck}
              >
                Check
              </Button>

              {result !== null ? (
                result.length === 0 ? (
                  <p className="text-sm text-muted-foreground">All covered — nothing missing.</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {result.map((skill) => (
                      <Badge key={skill} variant="destructive">
                        <TriangleAlert data-icon="inline-start" />
                        {skill}
                      </Badge>
                    ))}
                  </div>
                )
              ) : null}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {extraFooter}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
