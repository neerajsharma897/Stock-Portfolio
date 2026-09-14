"use client"

import { XIcon } from "lucide-react"
import { useTransition } from "react"

import { deleteMarketHoliday } from "@/app/(app)/settings/actions"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function DeleteHolidayButton({
  date,
  label,
}: {
  date: string
  label: string
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      disabled={pending}
      aria-label={`Remove ${label}`}
      onClick={() =>
        startTransition(async () => {
          showResult(await deleteMarketHoliday(date))
        })
      }
    >
      <XIcon />
    </Button>
  )
}
