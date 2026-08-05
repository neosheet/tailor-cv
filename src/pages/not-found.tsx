import { FileQuestionIcon } from "lucide-react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { sections } from "@/lib/navigation"

export function NotFoundPage() {
  return (
    <Empty className="min-h-72 flex-none border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <FileQuestionIcon />
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>
          That route doesn&apos;t exist. It may have moved, or it may not be
          built yet.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button
          variant="outline"
          render={<Link to={sections.dashboard.path} />}
          nativeButton={false}
        >
          Back to Dashboard
        </Button>
      </EmptyContent>
    </Empty>
  )
}
