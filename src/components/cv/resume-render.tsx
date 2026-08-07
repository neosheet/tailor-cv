import { TemplateRender } from "@/components/cv/templates"
import { cn } from "@/lib/utils"
import type { ResumeDocument } from "@/lib/persona"

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
  scale = 1,
  className,
}: {
  document: ResumeDocument
  /** Always explicit: a CV stores no template, layout is the caller's choice. */
  templateId: string
  scale?: number
  className?: string
}) {
  if (scale === 1) {
    return (
      <div className={className}>
        <TemplateRender templateId={templateId} document={document} />
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
      <div className="origin-top-left scale-[var(--resume-scale)]">
        <TemplateRender templateId={templateId} document={document} />
      </div>
    </div>
  )
}
