import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { NoteInput } from "@/components/inventory/note-input"
import { TagInput } from "@/components/inventory/tag-input"
import { cn } from "@/lib/utils"

/**
 * Note + tags fields tucked behind a "More" trigger, closed by default —
 * shared secondary-fields section for every add/edit form that carries both
 * (item, application, persona dialogs). `children`, when passed, render
 * ahead of Note/Tags inside the same collapsible — the application form uses
 * it for its other secondary fields (title, job type, working type, cover
 * letter, apply via) so they collapse behind the one "More" trigger too.
 */
export function NoteTagsCollapsible({
  note,
  onNoteChange,
  tags,
  onTagsChange,
  noteId,
  tagsId,
  className,
  children,
}: {
  note: string | null
  onNoteChange: (note: string | null) => void
  tags: string[]
  onTagsChange: (tags: string[]) => void
  noteId?: string
  tagsId?: string
  className?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger className="flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground">
        <ChevronDownIcon
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
        More
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 pt-3">
        {children}
        <NoteInput id={noteId} value={note} onValueChange={onNoteChange} />
        <TagInput id={tagsId} value={tags} onValueChange={onTagsChange} />
      </CollapsibleContent>
    </Collapsible>
  )
}
