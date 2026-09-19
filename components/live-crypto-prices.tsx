"use client"

import { CircleAlertIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import type { CryptoLiveStatus } from "@/lib/crypto/live-status"

const POLL_INTERVAL_MS = 30_000

const clockFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
})

/** Asks the server for fresh CoinDCX prices every 30 seconds while this tab is visible. */
export function LiveCryptoPrices({
  initialPricedAt,
}: {
  initialPricedAt: string | null
}) {
  const router = useRouter()
  const [pricedAt, setPricedAt] = useState(initialPricedAt)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/crypto/refresh", {
            method: "POST",
          })
          if (response.ok) {
            const next = (await response.json()) as CryptoLiveStatus
            if (cancelled) return
            setError(next.error)
            if (next.pricedAt) setPricedAt(next.pricedAt)
            if (next.refreshed > 0) router.refresh()
          }
        } catch {
          // Offline or signed out: try again on the next tick.
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [router])

  if (error) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs text-destructive"
        title={error}
      >
        <CircleAlertIcon className="size-3.5" aria-hidden />
        Crypto prices unavailable
        <span className="sr-only">: {error}</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-gain opacity-60 motion-reduce:hidden" />
        <span className="relative inline-flex size-2 rounded-full bg-gain" />
      </span>
      <span className="font-medium text-foreground">Crypto live</span>
      <span>
        · CoinDCX
        {pricedAt && `, ${clockFormatter.format(new Date(pricedAt))}`}
      </span>
    </span>
  )
}
