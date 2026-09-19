"use client"

import { PauseIcon, PlayIcon } from "lucide-react"
import { useTransition } from "react"

import { setAlertRuleActive } from "@/app/(app)/alerts/actions"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function PauseAlertButton({
  ruleId,
  active,
  label,
}: {
  ruleId: string
  active: boolean
  /** e.g. "TCS above ₹4,200" */
  label: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`${active ? "Pause" : "Resume"} alert: ${label}`}
      onClick={() =>
        startTransition(async () => {
          showResult(await setAlertRuleActive(ruleId, !active))
        })
      }
    >
      {active ? <PauseIcon /> : <PlayIcon />}
    </Button>
  )
}
