"use client"

import { RefreshCwIcon } from "lucide-react"
import { useTransition } from "react"

import { updateStockList } from "@/app/(app)/settings/actions"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"
import { cn } from "@/lib/utils"

export function UpdateStockListButton({ hasList }: { hasList: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      className="w-fit"
      variant={hasList ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          showResult(await updateStockList())
        })
      }
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
      {pending
        ? "Updating… (up to a minute)"
        : hasList
          ? "Update stock list"
          : "Download stock list"}
    </Button>
  )
}
