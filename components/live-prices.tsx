"use client"

import { CircleAlertIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { describeLiveStatus, type LiveStatus } from "@/lib/prices/live-status"

const POLL_INTERVAL_MS = 5_000

/**
 * Shows where prices come from and, when Angel One is set up, asks the server
 * to refresh them every 5 seconds while this tab is visible.
 */
export function LivePrices({ initialStatus }: { initialStatus: LiveStatus }) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const configured = initialStatus.configured

  useEffect(() => {
    if (!configured) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function poll() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch("/api/prices/refresh", {
            method: "POST",
          })
          if (response.ok) {
            const next = (await response.json()) as LiveStatus
            if (cancelled) return
            setStatus(next)
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
  }, [configured, router])

  const badge = describeLiveStatus(status)

  if (badge.tone === "manual") {
    return (
      <Link
        href="/settings"
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {badge.label} · {badge.detail}
      </Link>
    )
  }

  if (badge.tone === "error") {
    return (
      <Link
        href="/settings"
        className="inline-flex items-center gap-1.5 text-xs text-destructive underline-offset-4 hover:underline"
        title={badge.detail ?? undefined}
      >
        <CircleAlertIcon className="size-3.5" aria-hidden />
        {badge.label}
        <span className="sr-only">: {badge.detail}. Details in Settings.</span>
      </Link>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      {badge.tone === "live" ? (
        <span className="relative flex size-2" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-gain opacity-60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-gain" />
        </span>
      ) : (
        <span
          className="size-2 rounded-full bg-muted-foreground/50"
          aria-hidden
        />
      )}
      <span className="font-medium text-foreground">{badge.label}</span>
      {badge.detail && <span>· {badge.detail}</span>}
    </span>
  )
}
