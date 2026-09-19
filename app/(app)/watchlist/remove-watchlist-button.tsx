"use client"

import { Trash2Icon } from "lucide-react"

import { removeWatchlistItem } from "@/app/(app)/watchlist/actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { showResult } from "@/lib/show-result"

export function RemoveWatchlistButton({
  watchlistId,
  watchlistName,
  instrumentId,
  symbol,
}: {
  watchlistId: string
  watchlistName: string
  instrumentId: number
  symbol: string
}) {
  return (
    <ConfirmDialog
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${symbol} from ${watchlistName}`}
        >
          <Trash2Icon />
        </Button>
      }
      title={`Remove ${symbol}?`}
      description={`${symbol} and its note come off ${watchlistName}. Other lists keep it.`}
      confirmLabel="Remove"
      destructive
      onConfirm={async () =>
        showResult(await removeWatchlistItem(watchlistId, instrumentId))
      }
    />
  )
}
