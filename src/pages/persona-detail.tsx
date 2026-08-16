import { formatDistanceToNow } from "date-fns"
import {
  ArrowLeftIcon,
  CopyIcon,
  Ellipsis,
  PencilIcon,
  StarIcon,
  Trash2Icon,
  TriangleAlert,
  UsersIcon,
} from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import type { ReactNode } from "react"

import { ExternalLink } from "@/components/external-link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Separator } from "@/components/ui/separator"
import { LINE_HEADING } from "@/components/inventory/columns"
import { PoolPickerDialog } from "@/components/inventory/pool-picker-dialog"
import { DeletePersonaDialog } from "@/components/persona/delete-persona-dialog"
import { PersonaFormDialog } from "@/components/persona/persona-form-dialog"
import { SkillsCheckDialog } from "@/components/skills/skills-check-dialog"
import { useDialogSearchParams } from "@/hooks/use-dialog-search-params"
import { cvTemplates } from "@/lib/cv-templates"
import { allCvs } from "@/lib/cv"
import { useInventoryStore } from "@/lib/inventory-store"
import {
  buildResumeDocument,
  deletePersona,
  duplicatePersona,
  findPersona,
  itemIdsForKind,
  PICK_ONE_KINDS,
  SECTION_KINDS,
  setPersonaSectionItems,
  titleFor,
  togglePersonaFavorite,
  updatePersona,
  type ResumeEntry,
  type ResumeSection,
} from "@/lib/persona"
import { usePersonaStore } from "@/lib/persona-store"
import { skillTitlesOf } from "@/lib/skill-check"
import { useSkillsCheck } from "@/hooks/use-skills-check"
import type { ItemKind } from "@/mocks/types"

/** Left column of the two-column layout — the entries with the most content. */
const PRIMARY_KINDS: ItemKind[] = ["work", "project", "volunteer", "award"]

/**
 * One Persona — content only, no layout (that's what pairing it with a
 * Template into a CV is for). Every card maps to exactly one Inventory pool;
 * its "+" opens the real Inventory table for that pool as a picker. See
 * docs/specs/06-persona-cv-split.md and docs/plans/09-persona-cv-cutover.md.
 */
export function PersonaDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const inventoryStore = useInventoryStore()
  const personaStore = usePersonaStore()
  const { dialog, get, open, close } = useDialogSearchParams()
  const openKind =
    dialog === "pool-picker" ? (get("kind") as ItemKind | null) : null
  const formDialogMode =
    dialog === "edit" || dialog === "duplicate" ? dialog : null
  const deleting = dialog === "delete"
  const skillsCheckOpen = dialog === "skills-check"
  // In-memory only — never persisted, gone on refresh. See
  // docs/specs/14-missing-skills-check.md's "Persona detail page (ephemeral)".
  const skillsCheck = useSkillsCheck()

  const persona = id ? findPersona(personaStore, id) : undefined

  if (!persona) {
    return (
      <Empty className="min-h-72 flex-none border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UsersIcon />
          </EmptyMedia>
          <EmptyTitle>No such Persona</EmptyTitle>
          <EmptyDescription>
            That Persona doesn&apos;t exist, or it has been deleted.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="outline"
            render={<Link to="/personas" />}
            nativeButton={false}
          >
            Back to Personas
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const document = buildResumeDocument(personaStore, inventoryStore, persona.id)
  const availableSkills = skillTitlesOf(document)
  const usedByCvs = allCvs(personaStore).filter(
    (cv) => cv.personaId === persona.id
  )
  const sectionByKind = new Map(
    document.sections.map((section) => [section.kind, section])
  )
  const primaryKinds = SECTION_KINDS.filter((kind) =>
    PRIMARY_KINDS.includes(kind)
  )
  const secondaryKinds = SECTION_KINDS.filter(
    (kind) => !PRIMARY_KINDS.includes(kind)
  )

  const currentItemIds = (kind: ItemKind): string[] =>
    itemIdsForKind(personaStore, inventoryStore, persona.id, kind)

  const handleConfirm = async (itemIds: string[]) => {
    if (!openKind) return
    await setPersonaSectionItems(
      personaStore,
      inventoryStore,
      persona.id,
      openKind,
      itemIds,
      currentItemIds(openKind)
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link to="/personas" />}
        nativeButton={false}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Personas
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {persona.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Updated{" "}
            {formatDistanceToNow(new Date(persona.updatedAt), {
              addSuffix: true,
            })}
          </p>
          {/* Private to you — never part of this Persona's content or shown
              on a CV. Plain text, no card: it's metadata about the Persona,
              not a pool. */}
          {persona.note ? (
            <p className="text-sm text-muted-foreground">{persona.note}</p>
          ) : null}
          {persona.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {persona.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-muted-foreground"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="icon" />}>
            <Ellipsis data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => open("edit")}>
                <PencilIcon />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => togglePersonaFavorite(personaStore, persona.id)}
              >
                <StarIcon className={persona.favorite ? "fill-current" : undefined} />
                {persona.favorite ? "Remove from favourites" : "Favorite"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => open("duplicate")}>
                <CopyIcon />
                Duplicate
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => open("delete")}
              >
                <Trash2Icon />
                Delete
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Name / Headline / Summary — one card per Basics pool. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <BasicsCard
          label="Name"
          value={document.name || null}
          onPick={() => open("pool-picker", { kind: "name" })}
        />
        <BasicsCard
          label="Headline"
          value={document.headline}
          onPick={() => open("pool-picker", { kind: "headline" })}
        />
        <BasicsCard
          label="Summary"
          value={document.summary}
          onPick={() => open("pool-picker", { kind: "summary" })}
        />
      </div>

      {/* Contact / Location / Social — three separate pools, not one blended field. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Contact</CardTitle>
            <CardAction>
              <PickButton
                label="Contact"
                onClick={() => open("pool-picker", { kind: "contact" })}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            {document.contact ? (
              <>
                {document.contact.email ? <p>{document.contact.email}</p> : null}
                {document.contact.phone ? <p>{document.contact.phone}</p> : null}
                {document.contact.url ? <p>{document.contact.url}</p> : null}
              </>
            ) : (
              <p>—</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Location</CardTitle>
            <CardAction>
              <PickButton
                label="Location"
                onClick={() => open("pool-picker", { kind: "location" })}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>{document.location ?? "—"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Social</CardTitle>
            <CardAction>
              <PickButton
                label="Social"
                onClick={() => open("pool-picker", { kind: "social" })}
              />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
            {document.socials.length > 0 ? (
              document.socials.map((social) => (
                <p key={social.network}>
                  {social.network}
                  {social.username ? ` · ${social.username}` : ""}
                </p>
              ))
            ) : (
              <p>—</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Work, Projects, Volunteer, Awards | everything else */}
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          {primaryKinds.map((kind) => (
            <SectionCard
              key={kind}
              heading={titleFor(kind)}
              section={sectionByKind.get(kind)}
              onPick={() => open("pool-picker", { kind })}
            />
          ))}
        </div>
        <div className="flex flex-col gap-4">
          {secondaryKinds.map((kind) => (
            <SectionCard
              key={kind}
              heading={titleFor(kind)}
              section={sectionByKind.get(kind)}
              onPick={() => open("pool-picker", { kind })}
              extraAction={
                kind === "skill" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => open("skills-check")}
                  >
                    <TriangleAlert data-icon="inline-start" />
                    Check skills
                  </Button>
                ) : undefined
              }
            />
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Used in CVs</CardTitle>
            </CardHeader>
            <CardContent>
              {usedByCvs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not saved into any CV yet.
                </p>
              ) : (
                <ItemGroup className="gap-1">
                  {usedByCvs.map((cv) => {
                    const template = cvTemplates.find(
                      (candidate) => candidate.id === cv.templateId
                    )
                    return (
                      <Item key={cv.id} variant="outline">
                        <ItemContent>
                          <ItemTitle>
                            <Link
                              to={`/cvs/${cv.id}/print`}
                              className="hover:underline hover:underline-offset-4"
                            >
                              {cv.name}
                            </Link>
                          </ItemTitle>
                          {template ? (
                            <ItemDescription>{template.name}</ItemDescription>
                          ) : null}
                        </ItemContent>
                      </Item>
                    )
                  })}
                </ItemGroup>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <SkillsCheckDialog
        open={skillsCheckOpen}
        onOpenChange={(next) => !next && close()}
        value={skillsCheck.value}
        onValueChange={skillsCheck.setValue}
        result={skillsCheck.result}
        onCheck={() => skillsCheck.onCheck(availableSkills)}
      />

      <PoolPickerDialog
        kind={openKind ?? "work"}
        open={openKind !== null}
        onOpenChange={(next) => !next && close(["kind"])}
        title={openKind ? titleFor(openKind) : ""}
        singleSelect={openKind !== null && PICK_ONE_KINDS.includes(openKind)}
        initialSelected={openKind ? currentItemIds(openKind) : []}
        onConfirm={handleConfirm}
      />

      <PersonaFormDialog
        open={formDialogMode !== null}
        onOpenChange={(next) => !next && close()}
        title={formDialogMode === "edit" ? "Edit Persona" : "Duplicate Persona"}
        confirmLabel={formDialogMode === "edit" ? "Save" : "Duplicate"}
        initialName={
          formDialogMode === "edit" ? persona.name : `${persona.name} (Copy)`
        }
        initialNote={persona.note}
        initialTags={persona.tags}
        onSubmit={async (fields) => {
          if (formDialogMode === "edit") {
            await updatePersona(personaStore, persona.id, fields)
          } else if (formDialogMode === "duplicate") {
            const duplicated = await duplicatePersona(
              personaStore,
              persona.id,
              fields
            )
            navigate(`/personas/${duplicated.id}`)
          }
        }}
      />

      <DeletePersonaDialog
        persona={deleting ? persona : null}
        cvCount={usedByCvs.length}
        onCancel={() => close()}
        onConfirm={async () => {
          await deletePersona(personaStore, persona.id)
          navigate("/personas")
        }}
      />
    </div>
  )
}

function PickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={onClick}
      aria-label={`Pick ${label}`}
    >
      <PencilIcon />
    </Button>
  )
}

function BasicsCard({
  label,
  value,
  onPick,
}: {
  label: string
  value: string | null
  onPick: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{label}</CardTitle>
        <CardAction>
          <PickButton label={label} onClick={onPick} />
        </CardAction>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <p>{value || "—"}</p>
      </CardContent>
    </Card>
  )
}

function SectionCard({
  heading,
  section,
  onPick,
  extraAction,
}: {
  heading: string
  section: ResumeSection | undefined
  onPick: () => void
  /** An extra action alongside `PickButton` — used by the Skills card's "Check skills" trigger. */
  extraAction?: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{heading}</CardTitle>
        <CardAction className="flex items-center gap-1">
          {extraAction}
          <PickButton label={heading} onClick={onPick} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!section || section.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No entries selected yet.
          </p>
        ) : section.kind === "skill" && section.skillGroups ? (
          section.skillGroups.map((group, index) => (
            <div key={group.category} className="flex flex-col gap-2">
              {index > 0 ? <Separator /> : null}
              <p className="text-sm font-medium">{group.category}</p>
              <div className="flex flex-wrap gap-1">
                {group.skills.map((skill) => (
                  <Badge key={skill} variant="secondary">
                    {skill}
                  </Badge>
                ))}
              </div>
            </div>
          ))
        ) : (
          section.entries.map((entry, index) => (
            <div key={entry.id} className="flex flex-col gap-2">
              {index > 0 ? <Separator /> : null}
              <EntryView entry={entry} />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function EntryView({ entry }: { entry: ResumeEntry }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div>
          <p className="font-medium">
            {entry.title}
            {entry.kind === "work" && entry.url ? (
              <ExternalLink
                href={entry.url}
                className="ml-2 text-xs font-normal text-muted-foreground hover:underline hover:underline-offset-4"
              >
                {entry.url}
              </ExternalLink>
            ) : null}
          </p>
          {entry.subtitle ? (
            <p className="text-sm text-muted-foreground">{entry.subtitle}</p>
          ) : null}
        </div>
        {entry.dateRangeText ? (
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {entry.dateRangeText}
          </span>
        ) : null}
      </div>

      {entry.summary ? <p className="text-sm">{entry.summary}</p> : null}

      {entry.lineGroups.map((group) => (
        <div key={group.kind} className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">
            {LINE_HEADING[group.kind]}
          </p>
          <ul className="list-disc pl-5 text-sm">
            {group.items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      ))}

      {entry.skills.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {entry.skills.map((skill) => (
            <Badge key={skill} variant="secondary">
              {skill}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
