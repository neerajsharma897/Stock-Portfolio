"use client"

import { RefreshCwIcon } from "lucide-react"
import { useEffect, useState, useTransition } from "react"

import { refreshNewsAction } from "@/app/(app)/news/actions"

/**
 * Checks Google News once when the page opens, if any stock is due. The page
 * refreshes itself when new headlines are saved.
 */
export function NewsRefresher({
  instrumentId,
  due,
}: {
  instrumentId: number | null
  due: boolean
}) {
  const [checking, startChecking] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!due) return
    startChecking(async () => {
      const result = await refreshNewsAction(instrumentId)
      setError(
        result?.status === "error"
          ? (result.message ?? "Couldn't check for news.")
          : null,
      )
    })
  }, [due, instrumentId])

  if (checking) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        role="status"
      >
        <RefreshCwIcon className="size-3.5 animate-spin" aria-hidden />
        Checking Google News…
      </span>
    )
  }
  if (error) {
    return (
      <span className="text-xs text-destructive" role="alert">
        {error}
      </span>
    )
  }
  return null
}
