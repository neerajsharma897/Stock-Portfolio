"use client"

import { Trash2Icon } from "lucide-react"
import { useRouter } from "next/navigation"

import { deleteWatchlist } from "@/app/(app)/watchlist/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function DeleteWatchlistButton({
  watchlistId,
  name,
  stockCount,
}: {
  watchlistId: string
  name: string
  stockCount: number
}) {
  const router = useRouter()

  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2Icon />
        </Button>
      }
      title={`Delete ${name}?`}
      description={
        stockCount > 0
          ? `The list and its ${stockCount} ${stockCount === 1 ? "stock" : "stocks"} (with notes) are deleted. Other lists and holdings aren't affected. This can't be undone.`
          : "The empty list is deleted."
      }
      confirmLabel="Delete list"
      destructive
      onConfirm={async () => {
        const deleted = showResult(await deleteWatchlist(watchlistId))
        if (deleted) router.push("/watchlist")
        return deleted
      }}
    />
  )
}
