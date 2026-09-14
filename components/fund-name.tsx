import { Badge } from "@/components/ui/badge"
import {
  fundOptionLabel,
  MF_PLAN_LABELS,
  type MfOption,
  type MfPlan,
} from "@/lib/mutual-funds/options"

export type FundNameDetails = {
  name: string
  plan: MfPlan | null
  option_type: MfOption | null
  option_label: string | null
  is_active: boolean
}

/** A fund's name with its plan (Direct/Regular), option and an optional detail line. */
export function FundName({
  scheme,
  detail,
}: {
  scheme: FundNameDetails | undefined
  detail?: string
}) {
  const option = scheme ? fundOptionLabel(scheme) : null
  return (
    <>
      <div className="font-medium">{scheme?.name ?? "Unknown fund"}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        {scheme?.plan && (
          <Badge variant={scheme.plan === "regular" ? "outline" : "secondary"}>
            {MF_PLAN_LABELS[scheme.plan]}
          </Badge>
        )}
        {option && <span>{option}</span>}
        {scheme && !scheme.is_active && <Badge variant="outline">Closed</Badge>}
        {detail && <span>{detail}</span>}
      </div>
    </>
  )
}
