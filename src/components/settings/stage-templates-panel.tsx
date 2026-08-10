import * as React from "react"
import { ListChecksIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldError } from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchInput } from "@/components/search-input"
import {
  DeleteStageTemplateDialog,
  RenameStageTemplateDialog,
} from "@/components/settings/stage-template-dialogs"
import {
  BUILT_IN_STAGE_CATEGORIES,
  STAGE_CATEGORY_LABEL,
  stageCategoryLabel,
} from "@/lib/stage-category"
import {
  createStageTemplate,
  deleteStageTemplate,
  listStageTemplates,
  updateStageTemplate,
  validateStageTemplateName,
} from "@/lib/stage-templates"
import { useApplicationStore } from "@/lib/application-store"
import type { BuiltInStageCategory, DbStageTemplate } from "@/mocks/types"

/**
 * The Stage Templates registry — every reusable stage name + default category,
 * managed the same way `SkillCategoriesPanel` manages skill categories.
 *
 * One structural difference from that reference panel: there is no "Used on"
 * column here and no orphan warning in the delete dialog. `stage_templates` is
 * a pure autocomplete-suggestion registry — `application_stages.name`/
 * `category` are plain denormalized `text` columns, copied at creation time,
 * never a foreign key into this table. A recorded stage is a point-in-time
 * snapshot of one step in a real hiring pipeline; retroactively renaming or
 * deleting the *template* must never rewrite an application's actual history.
 * So unlike Tags (enforced via `assert_tags_registered()`) or Skill Categories
 * (a real FK with an orphan-on-delete warning), there is nothing to count and
 * nothing to warn about here — this is deliberate, not an oversight.
 */
export function StageTemplatesPanel() {
  const store = useApplicationStore()
  const templates = listStageTemplates(store)
  const [query, setQuery] = React.useState("")

  const [renaming, setRenaming] = React.useState<DbStageTemplate | null>(null)
  const [deleting, setDeleting] = React.useState<DbStageTemplate | null>(null)

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? templates.filter((template) => template.name.toLowerCase().includes(needle))
    : templates

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Reusable stage names and their default category, suggested while adding
        a stage to an application's timeline. Renaming or deleting a template
        here never changes stages already recorded on an application.
      </p>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <SearchInput value={query} onChange={setQuery} label="stage templates" />
        <AddStageTemplateField
          registry={store.stageTemplates}
          onAdd={async (name, category) => {
            await createStageTemplate(store, name, category)
          }}
        />
      </div>

      {templates.length === 0 ? (
        <Empty className="min-h-48 flex-none border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ListChecksIcon />
            </EmptyMedia>
            <EmptyTitle>No stage templates yet</EmptyTitle>
            <EmptyDescription>
              Add one above, then pick it while adding a stage to an
              application's timeline.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No stage templates match “{query}”.
                  </TableCell>
                </TableRow>
              ) : null}
              {visible.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {stageCategoryLabel(template.category)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setRenaming(template)}
                        aria-label={`Rename ${template.name}`}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleting(template)}
                        aria-label={`Delete ${template.name}`}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {renaming ? (
        <RenameStageTemplateDialog
          key={renaming.id}
          template={renaming}
          open
          onCancel={() => setRenaming(null)}
          onRename={async (name, category) => {
            await updateStageTemplate(store, renaming.id, { name, category })
            setRenaming(null)
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteStageTemplateDialog
          template={deleting}
          open
          onCancel={() => setDeleting(null)}
          onDelete={async () => {
            await deleteStageTemplate(store, deleting.id)
            setDeleting(null)
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Adding a stage template needs two fields (name + default category), so it's
 * an inline row rather than a dialog — same reasoning as `AddCategoryField`,
 * just with a second control.
 */
function AddStageTemplateField({
  registry,
  onAdd,
}: {
  registry: DbStageTemplate[]
  onAdd: (name: string, category: BuiltInStageCategory) => void
}) {
  const [name, setName] = React.useState("")
  const [category, setCategory] = React.useState<BuiltInStageCategory>("custom")
  const problem = validateStageTemplateName(name, registry)
  const showProblem = name.trim().length > 0 && problem !== null

  function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!problem) {
      onAdd(name, category)
      setName("")
      setCategory("custom")
    }
  }

  return (
    <form onSubmit={submit}>
      <Field
        className="w-full sm:w-auto"
        data-invalid={showProblem ? true : undefined}
      >
        <div className="flex flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-56">
            <InputGroupAddon>
              <ListChecksIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New stage template…"
              aria-label="New stage template name"
              aria-invalid={showProblem ? true : undefined}
            />
          </InputGroup>
          <Select
            items={BUILT_IN_STAGE_CATEGORIES.map((value) => ({
              value,
              label: STAGE_CATEGORY_LABEL[value],
            }))}
            value={category}
            onValueChange={(next) => setCategory(next as BuiltInStageCategory)}
          >
            <SelectTrigger
              className="w-full sm:w-48"
              aria-label="New stage template category"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {BUILT_IN_STAGE_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {STAGE_CATEGORY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" disabled={Boolean(problem)}>
            <PlusIcon data-icon="inline-start" />
            Add template
          </Button>
        </div>
        {showProblem ? <FieldError>{problem}</FieldError> : null}
      </Field>
    </form>
  )
}
