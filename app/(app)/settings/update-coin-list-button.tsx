"use client"

import { RefreshCwIcon } from "lucide-react"
import { useTransition } from "react"

import { updateCoinList } from "@/app/(app)/settings/actions"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"
import { cn } from "@/lib/utils"

export function UpdateCoinListButton({ hasList }: { hasList: boolean }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      className="w-fit"
      variant={hasList ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          showResult(await updateCoinList())
        })
      }
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
      {pending
        ? "Updating…"
        : hasList
          ? "Update coin list & prices"
          : "Download coin list"}
    </Button>
  )
}
