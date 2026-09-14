// Shared between the server (which builds the status) and the live prices badge.

import type { MarketStatus } from "@/lib/market-hours"

export type LiveStatus = {
  /** All four ANGELONE_* settings are present. */
  configured: boolean
  market: MarketStatus
  /** Prices saved by this refresh (0 when it was skipped). */
  refreshed: number
  /** When prices were last fetched from Angel One, if ever. */
  lastFetchedAt: string | null
  error: string | null
}

export type LiveBadge = {
  tone: "manual" | "live" | "closed" | "error"
  label: string
  detail: string | null
}

const clockFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
})

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

export function describeLiveStatus(status: LiveStatus): LiveBadge {
  if (!status.configured) {
    return {
      tone: "manual",
      label: "Prices entered by hand",
      detail: "Set up live prices in Settings",
    }
  }
  if (status.error) {
    return {
      tone: "error",
      label: "Live prices unavailable",
      detail: status.error,
    }
  }

  const fetchedAt = status.lastFetchedAt ? new Date(status.lastFetchedAt) : null
  if (status.market.open) {
    return {
      tone: "live",
      label: "Live",
      detail: fetchedAt
        ? `updated ${clockFormatter.format(fetchedAt)}`
        : "fetching prices…",
    }
  }

  const { reason, holiday } = status.market
  const label =
    reason === "weekend"
      ? "Market closed for the weekend"
      : reason === "holiday"
        ? `Market holiday: ${holiday}`
        : reason === "before_open"
          ? "Market opens at 9:15 AM"
          : "Market closed"
  return {
    tone: "closed",
    label,
    detail: fetchedAt
      ? `prices as of ${dateTimeFormatter.format(fetchedAt)}`
      : null,
  }
}
