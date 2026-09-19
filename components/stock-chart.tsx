"use client"

import { ChartCandlestickIcon, ChartLineIcon } from "lucide-react"
import type {
  IChartApi,
  ISeriesApi,
  TickMarkType,
  Time,
  UTCTimestamp,
} from "lightweight-charts"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"

import { toneOf, toneTextClass } from "@/components/stat-tile"
import {
  CHART_RANGES,
  liveBucket,
  rangeChange,
  type Candle,
  type ChartRange,
} from "@/lib/charts/candles"
import { formatINR, formatPercent, formatSignedINR } from "@/lib/format"
import { cn } from "@/lib/utils"

type ChartLibrary = typeof import("lightweight-charts")
type ChartResult = { candles: Candle[]; intraday: boolean } | { error: string }
type ChartStyle = "line" | "candles"
type PriceSeries = ISeriesApi<"Area"> | ISeriesApi<"Candlestick">

export type LivePrice = { lastPrice: number; pricedAt: string }

// The day chart asks the server again this often; the server reuses its copy for 50 seconds.
const POLL_INTERVAL_MS = 60_000

const RANGE_WORDS: Record<ChartRange, string> = {
  "1D": "today",
  "1W": "in 1 week",
  "1M": "in 1 month",
  "6M": "in 6 months",
  "1Y": "in 1 year",
  "5Y": "in 5 years",
}

const INDIA = "Asia/Kolkata"
const clockFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA,
  hour: "numeric",
  minute: "2-digit",
})
const dayFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA,
  day: "numeric",
  month: "short",
})
const monthFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA,
  month: "short",
})
const yearFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA,
  year: "numeric",
})
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA,
  dateStyle: "medium",
})
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: INDIA,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

const toDate = (time: Time) => new Date(Number(time) * 1000)

function themeColor(name: string, fallback: string) {
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  )
}

function withAlpha(hex: string, alpha: number) {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const value = parseInt(match[1], 16)
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

function candlesOf(result: ChartResult | null): Candle[] | null {
  return result && "candles" in result ? result.candles : null
}

function SegmentButton({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  label?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active && "bg-card text-foreground shadow-xs",
      )}
    >
      {children}
    </button>
  )
}

/**
 * A stock's price chart from Angel One's history, with ranges from a day to five
 * years. While the market is open the day chart follows the live price.
 */
export function StockChart({
  instrumentId,
  symbol,
  previousClose,
  livePrice,
  marketOpen,
}: {
  instrumentId: number
  symbol: string
  previousClose: number | null
  livePrice: LivePrice | null
  marketOpen: boolean
}) {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const libraryRef = useRef<ChartLibrary | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<PriceSeries | null>(null)
  const [ready, setReady] = useState(false)
  const [range, setRange] = useState<ChartRange>("1D")
  const [style, setStyle] = useState<ChartStyle>("line")
  const [loaded, setLoaded] = useState<{
    range: ChartRange
    result: ChartResult
  } | null>(null)

  const result = loaded?.range === range ? loaded.result : null
  const candles = candlesOf(result)
  const followsLive =
    range === "1D" &&
    marketOpen &&
    livePrice !== null &&
    !!candles?.length &&
    liveBucket(livePrice.pricedAt) >= candles[candles.length - 1].time
  const summary = candles
    ? rangeChange(
        candles,
        range,
        previousClose,
        followsLive ? livePrice?.lastPrice : undefined,
      )
    : null

  // Create the chart once; the library loads only when a chart opens.
  useEffect(() => {
    let disposed = false
    let chart: IChartApi | null = null
    void import("lightweight-charts").then((library) => {
      if (disposed || !containerRef.current) return
      libraryRef.current = library
      chart = library.createChart(containerRef.current, {
        autoSize: true,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false, secondsVisible: false },
      })
      chartRef.current = chart
      setReady(true)
    })
    return () => {
      disposed = true
      chart?.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Load the range, and keep the day chart fresh while the market is open.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    async function load() {
      if (document.visibilityState === "visible") {
        let next: ChartResult
        try {
          const response = await fetch(
            `/api/charts?instrument=${instrumentId}&range=${range}`,
            { cache: "no-store" },
          )
          next = (await response.json()) as ChartResult
        } catch {
          next = { error: "Couldn't load the chart. Check the connection." }
        }
        if (cancelled) return
        setLoaded({ range, result: next })
      }
      if (!cancelled && range === "1D" && marketOpen) {
        timer = setTimeout(load, POLL_INTERVAL_MS)
      }
    }

    void load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [instrumentId, range, marketOpen])

  // Draw the candles in the chosen style and theme.
  useEffect(() => {
    const library = libraryRef.current
    const chart = chartRef.current
    const data = candlesOf(result)
    if (!ready || !library || !chart || !result || !data) return

    const intraday = "intraday" in result && result.intraday
    const text = themeColor("--muted-foreground", "#5d6775")
    const grid = themeColor("--border", "#e0e0ec")
    const gain = themeColor("--gain", "#15803d")
    const loss = themeColor("--loss", "#d92d20")

    chart.applyOptions({
      layout: {
        background: { type: library.ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: "inherit",
      },
      grid: { vertLines: { visible: false }, horzLines: { color: grid } },
      localization: {
        locale: "en-IN",
        priceFormatter: (price: number) => formatINR(price),
        timeFormatter: (time: Time) =>
          (intraday ? dateTimeFormat : dateFormat).format(toDate(time)),
      },
      timeScale: {
        timeVisible: intraday,
        tickMarkFormatter: (time: Time, type: TickMarkType) => {
          const date = toDate(time)
          if (type === library.TickMarkType.Year) return yearFormat.format(date)
          if (type === library.TickMarkType.Month) {
            return monthFormat.format(date)
          }
          if (type === library.TickMarkType.DayOfMonth) {
            return dayFormat.format(date)
          }
          return clockFormat.format(date)
        },
      },
    })

    if (seriesRef.current) chart.removeSeries(seriesRef.current)
    seriesRef.current = null
    if (data.length === 0) return

    const change = rangeChange(data, range, previousClose)
    const color = (change?.change ?? 0) >= 0 ? gain : loss
    if (style === "line") {
      const series = chart.addSeries(library.AreaSeries, {
        lineColor: color,
        topColor: withAlpha(color, 0.28),
        bottomColor: withAlpha(color, 0),
        lineWidth: 2,
        priceLineVisible: false,
      })
      series.setData(
        data.map((candle) => ({
          time: candle.time as UTCTimestamp,
          value: candle.close,
        })),
      )
      seriesRef.current = series
    } else {
      const series = chart.addSeries(library.CandlestickSeries, {
        upColor: gain,
        downColor: loss,
        wickUpColor: gain,
        wickDownColor: loss,
        borderVisible: false,
        priceLineVisible: false,
      })
      series.setData(
        data.map((candle) => ({
          ...candle,
          time: candle.time as UTCTimestamp,
        })),
      )
      seriesRef.current = series
    }
    chart.timeScale().fitContent()
  }, [ready, result, style, resolvedTheme, range, previousClose])

  // Move the last point with the live price (updated every few seconds by the page).
  useEffect(() => {
    const series = seriesRef.current
    const data = candlesOf(result)
    if (!ready || !series || !data?.length || !followsLive || !livePrice) {
      return
    }
    const last = data[data.length - 1]
    const time = liveBucket(livePrice.pricedAt) as UTCTimestamp
    const price = livePrice.lastPrice
    try {
      if (style === "line") {
        ;(series as ISeriesApi<"Area">).update({ time, value: price })
      } else {
        const sameCandle = time === last.time
        ;(series as ISeriesApi<"Candlestick">).update({
          time,
          open: sameCandle ? last.open : price,
          high: sameCandle ? Math.max(last.high, price) : price,
          low: sameCandle ? Math.min(last.low, price) : price,
          close: price,
        })
      }
    } catch {
      // A price older than the chart's last point: the next chart load catches up.
    }
  }, [ready, result, style, followsLive, livePrice])

  const message = !result
    ? "Loading chart…"
    : "error" in result
      ? result.error
      : result.candles.length === 0
        ? "No trades in this period."
        : null
  const rangeWords =
    range === "1D" && !marketOpen ? "in the last session" : RANGE_WORDS[range]

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="grid gap-0.5" aria-live="polite">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {summary ? formatINR(summary.last) : "—"}
          </p>
          <p
            className={cn(
              "text-sm font-medium tabular-nums",
              summary
                ? toneTextClass(toneOf(summary.change))
                : "text-muted-foreground",
            )}
          >
            {summary
              ? `${formatSignedINR(summary.change)} (${formatPercent(summary.changePct)}) ${rangeWords}`
              : " "}
          </p>
        </div>
        <div
          role="group"
          aria-label="Chart style"
          className="flex gap-1 rounded-lg bg-muted p-1"
        >
          <SegmentButton
            active={style === "line"}
            onClick={() => setStyle("line")}
            label="Line chart"
          >
            <ChartLineIcon className="size-4" aria-hidden />
          </SegmentButton>
          <SegmentButton
            active={style === "candles"}
            onClick={() => setStyle("candles")}
            label="Candlestick chart"
          >
            <ChartCandlestickIcon className="size-4" aria-hidden />
          </SegmentButton>
        </div>
      </div>

      <div
        role="group"
        aria-label="Time range"
        className="grid grid-cols-6 gap-1 rounded-lg bg-muted p-1"
      >
        {CHART_RANGES.map((value) => (
          <SegmentButton
            key={value}
            active={range === value}
            onClick={() => setRange(value)}
          >
            {value}
          </SegmentButton>
        ))}
      </div>

      <div className="relative h-72 sm:h-80">
        <div
          ref={containerRef}
          className="absolute inset-0"
          role="img"
          aria-label={`${symbol} price chart, ${RANGE_WORDS[range]}`}
        />
        {message && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/85 p-6 text-center text-sm text-muted-foreground">
            {message}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {followsLive
          ? "Following the live price while the market is open."
          : "Price history from Angel One."}{" "}
        Drag to scroll; pinch or use the mouse wheel to zoom.
      </p>
    </div>
  )
}
