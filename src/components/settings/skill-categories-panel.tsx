import * as React from "react"
import { PencilIcon, PlusIcon, Trash2Icon, WrenchIcon } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SearchInput } from "@/components/search-input"
import {
  DeleteSkillCategoryDialog,
  RenameSkillCategoryDialog,
} from "@/components/settings/skill-category-dialogs"
import {
  categoryUsageLabel,
  createSkillCategory,
  deleteSkillCategory,
  listSkillCategories,
  renameSkillCategory,
  validateCategoryName,
} from "@/lib/skill-categories"
import { useInventoryStore, type SkillCategory } from "@/lib/inventory-store"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"

/**
 * The skill category registry — every category and what it's on, managed the
 * same way `TagsPanel` manages tags. No bulk actions here: unlike tags, a
 * category is a single FK per skill, so there's no batch-tagging workflow to
 * mirror — just add, rename, delete, one row at a time.
 */
export function SkillCategoriesPanel() {
  const store = useInventoryStore()
  const categories = listSkillCategories(store)
  const [query, setQuery] = React.useState("")

  const { dialog, get, open, close } = useDialogSearchParams()
  const renaming =
    dialog === "rename-skill-category"
      ? (categories.find((category) => category.id === get("id")) ?? null)
      : null
  const deleting =
    dialog === "delete-skill-category"
      ? (categories.find((category) => category.id === get("id")) ?? null)
      : null

  const needle = query.trim().toLowerCase()
  const visible = needle
    ? categories.filter((category) => category.name.toLowerCase().includes(needle))
    : categories

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        The categories skills are grouped under — one per skill. Managed here,
        same as Tags, and picked from the Category field on a skill.
      </p>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <SearchInput value={query} onChange={setQuery} label="skill categories" />
        <AddCategoryField
          registry={store.skillCategories}
          onAdd={async (name) => {
            await createSkillCategory(store, name)
          }}
        />
      </div>

      {categories.length === 0 ? (
        <Empty className="min-h-48 flex-none border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WrenchIcon />
            </EmptyMedia>
            <EmptyTitle>No skill categories yet</EmptyTitle>
            <EmptyDescription>
              Add one above, then assign it to skills in the Skills pool.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Used on</TableHead>
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
                    No categories match “{query}”.
                  </TableCell>
                </TableRow>
              ) : null}
              {visible.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {categoryUsageLabel(category)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          open("rename-skill-category", { id: category.id })
                        }
                        aria-label={`Rename ${category.name}`}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() =>
                          open("delete-skill-category", { id: category.id })
                        }
                        aria-label={`Delete ${category.name}`}
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
        <RenameSkillCategoryDialog
          key={renaming.id}
          category={renaming}
          open
          onCancel={() => close(["id"])}
          onRename={async (name) => {
            await renameSkillCategory(store, renaming.id, name)
            close(["id"])
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteSkillCategoryDialog
          category={deleting}
          open
          onCancel={() => close(["id"])}
          onDelete={async () => {
            await deleteSkillCategory(store, deleting.id)
            close(["id"])
          }}
        />
      ) : null}
    </div>
  )
}

/**
 * Adding a category is one text field, so it's inline rather than behind a
 * dialog — same reasoning as `TagsPanel`'s `AddTagField`.
 */
function AddCategoryField({
  registry,
  onAdd,
}: {
  registry: SkillCategory[]
  onAdd: (name: string) => void
}) {
  const [value, setValue] = React.useState("")
  const problem = validateCategoryName(value, registry)
  const showProblem = value.trim().length > 0 && problem !== null

  function submit(event: React.FormEvent) {
    event.preventDefault()

    if (!problem) {
      onAdd(value)
      setValue("")
    }
  }

  return (
    <form onSubmit={submit}>
      <Field
        className="w-full sm:w-auto"
        data-invalid={showProblem ? true : undefined}
      >
        <div className="flex items-center gap-2">
          <InputGroup className="w-full sm:w-56">
            <InputGroupAddon>
              <WrenchIcon />
            </InputGroupAddon>
            <InputGroupInput
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="New category…"
              aria-label="New category name"
              aria-invalid={showProblem ? true : undefined}
            />
          </InputGroup>
          <Button type="submit" variant="outline" disabled={Boolean(problem)}>
            <PlusIcon data-icon="inline-start" />
            Add category
          </Button>
        </div>
        {showProblem ? <FieldError>{problem}</FieldError> : null}
      </Field>
    </form>
  )
}
