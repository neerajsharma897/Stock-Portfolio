import { ConstructionIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/** Placeholder for pages that are built in a later stage (see PLAN.md §16). */
export function ComingSoon({
  stage,
  title,
  items,
}: {
  stage: number
  title: string
  items: string[]
}) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ConstructionIcon
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          Coming in Stage {stage}: {title}
        </CardTitle>
        <CardDescription>What this page will show:</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
