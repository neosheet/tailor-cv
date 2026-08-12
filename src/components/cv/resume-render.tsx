import { TemplateRender } from "@/components/cv/templates"
import { cn } from "@/lib/utils"
import type { TemplateDefinition, TemplateSettings } from "@/lib/cv-template-schema"
import type { ResumeDocument } from "@/lib/persona"
import type { DbCvTemplate } from "@/mocks/types"

/**
 * A rendered CV at a chosen scale.
 *
 * The page is always laid out at its true A4 width and then scaled with a CSS
 * transform, so a thumbnail and a print are the same render — a thumbnail that
 * reflowed to its container would be lying about what prints.
 *
 * `--resume-scale` is passed as a custom property rather than an inline style
 * rule (the pattern `SidebarProvider` uses for `--sidebar-width`), so the
 * styling itself stays in utility classes. `transform` does not affect layout,
 * hence the explicit scaled box around it.
 */
export function ResumeRender({
  document,
  templateId,
  definition,
  settings,
  savedTemplates = [],
  scale = 1,
  className,
  ref
}: {
  ref?: React.Ref<HTMLDivElement>
  document: ResumeDocument
  /** Always explicit: a CV stores no template, layout is the caller's choice. */
  templateId: string
  /** Renders this inlined definition directly, bypassing the `templateId` registry lookup — see `TemplateRender`. */
  definition?: TemplateDefinition
  /** Per-CV style overrides — see `cv-template-schema.ts`'s `TemplateSettings`. */
  settings?: TemplateSettings
  /** A user's saved (Save-as-new-template) rows — checked when `templateId` isn't a built-in. */
  savedTemplates?: DbCvTemplate[]
  scale?: number
  className?: string
}) {
  if (scale === 1) {
    return (
      <div className={className}>
        <TemplateRender ref={ref} templateId={templateId} definition={definition} document={document} settings={settings} savedTemplates={savedTemplates} />
      </div>
    )
  }

  return (
    <div

      className={cn(
        "h-[calc(1123px*var(--resume-scale))] w-[calc(794px*var(--resume-scale))] overflow-hidden",
        className
      )}
      style={{ "--resume-scale": scale } as React.CSSProperties}
    >
      <div className="origin-top-left scale-(--resume-scale)">
        <TemplateRender ref={ref} templateId={templateId} definition={definition} document={document} settings={settings} savedTemplates={savedTemplates} />
      </div>
    </div>
  )
}
