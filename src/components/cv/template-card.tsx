import { EyeIcon, FileCheck2Icon, PrinterIcon, RulerIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ResumeRender } from "@/components/cv/resume-render"
import type { CvTemplate } from "@/lib/cv-templates"
import type { ResumeDocument } from "@/lib/persona"

function Spec({
  icon: Icon,
  children,
}: {
  icon: typeof PrinterIcon
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="size-3.5" />
      <span>{children}</span>
    </div>
  )
}

export function TemplateCard({
  template,
  document,
  onView,
}: {
  template: CvTemplate
  /** Real content, so the thumbnail is the render rather than a mockup. */
  document: ResumeDocument
  onView: () => void
}) {
  return (
    <Card className="flex flex-col">
      <CardContent>
        <div className="mx-auto w-fit overflow-hidden rounded-md ring-1 ring-foreground/10">
          <ResumeRender
            document={document}
            templateId={template.id}
            scale={0.26}
          />
        </div>
      </CardContent>
      <CardHeader>
        <CardTitle>{template.name}</CardTitle>
        <CardDescription>{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <Spec icon={PrinterIcon}>{template.definition.page.size}</Spec>
          <Spec icon={RulerIcon}>{template.density}</Spec>
          <Spec icon={FileCheck2Icon}>
            {template.atsSafe ? "Parser-safe" : "Human-first"}
          </Spec>
        </div>
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Best for: </span>
          {template.bestFor}
        </p>
      </CardContent>
      <CardFooter className="border-t pt-4">
        <Button variant="outline" className="w-full" onClick={onView}>
          <EyeIcon data-icon="inline-start" />
          View
        </Button>
      </CardFooter>
    </Card>
  )
}
