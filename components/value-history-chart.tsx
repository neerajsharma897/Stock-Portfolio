"use client"

import type { IChartApi, ISeriesApi, Time } from "lightweight-charts"
import { useTheme } from "next-themes"
import { useEffect, useRef, useState } from "react"

import { toneOf, toneTextClass } from "@/components/stat-tile"
import { formatCompactINR, formatINR, formatSignedINR } from "@/lib/format"
import { cn } from "@/lib/utils"

export type HistoryPoint = {
  /** YYYY-MM-DD */
  date: string
  value: number
  invested: number
}

type ChartLibrary = typeof import("lightweight-charts")

const RANGES = [
  { key: "1M", label: "1M", months: 1, words: "in 1 month" },
  { key: "6M", label: "6M", months: 6, words: "in 6 months" },
  { key: "1Y", label: "1Y", months: 12, words: "in 1 year" },
  { key: "ALL", label: "All", months: null, words: "" },
] as const
type RangeKey = (typeof RANGES)[number]["key"]

const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeZone: "UTC",
})
const shortDate = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})

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

function monthsBefore(date: string, months: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCMonth(value.getUTCMonth() - months)
  return value.toISOString().slice(0, 10)
}

/** Value and money invested over time, from the daily snapshots. */
export function ValueHistoryChart({ points }: { points: HistoryPoint[] }) {
  const { resolvedTheme } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const libraryRef = useRef<ChartLibrary | null>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area" | "Line">[]>([])
  const [ready, setReady] = useState(false)
  const [range, setRange] = useState<RangeKey>("1Y")

  const last = points[points.length - 1]
  const spec = RANGES.find((item) => item.key === range) ?? RANGES[3]
  const from =
    last && spec.months !== null ? monthsBefore(last.date, spec.months) : ""
  const shown = points.filter((point) => point.date >= from)
  const first = shown[0]
  const change = first && last ? last.value - first.value : 0
  const newMoney = first && last ? last.invested - first.invested : 0
  // Say "since 15 Sept" when the history is shorter than the range.
  const words =
    first && (spec.months === null || first.date > from)
      ? `since ${shortDate.format(new Date(first.date))}`
      : spec.words

  useEffect(() => {
    let disposed = false
    let chart: IChartApi | null = null
    void import("lightweight-charts").then((library) => {
      if (disposed || !containerRef.current) return
      libraryRef.current = library
      chart = library.createChart(containerRef.current, {
        autoSize: true,
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
        handleScroll: false,
        handleScale: false,
      })
      chartRef.current = chart
      setReady(true)
    })
    return () => {
      disposed = true
      chart?.remove()
      chartRef.current = null
      seriesRef.current = []
    }
  }, [])

  useEffect(() => {
    const library = libraryRef.current
    const chart = chartRef.current
    if (!ready || !library || !chart) return

    const text = themeColor("--muted-foreground", "#5d6775")
    const grid = themeColor("--border", "#e0e0ec")
    const primary = themeColor("--primary", "#4f46e5")
    chart.applyOptions({
      layout: {
        background: { type: library.ColorType.Solid, color: "transparent" },
        textColor: text,
        fontFamily: "inherit",
      },
      grid: { vertLines: { visible: false }, horzLines: { color: grid } },
      localization: {
        locale: "en-IN",
        priceFormatter: (price: number) => formatCompactINR(price),
        timeFormatter: (time: Time) =>
          typeof time === "string" ? dateFormat.format(new Date(time)) : "",
      },
    })

    for (const series of seriesRef.current) chart.removeSeries(series)
    const valueSeries = chart.addSeries(library.AreaSeries, {
      lineColor: primary,
      topColor: withAlpha(primary, 0.25),
      bottomColor: withAlpha(primary, 0),
      lineWidth: 2,
      priceLineVisible: false,
      title: "Value",
    })
    valueSeries.setData(
      shown.map((point) => ({ time: point.date, value: point.value })),
    )
    const investedSeries = chart.addSeries(library.LineSeries, {
      color: text,
      lineWidth: 1,
      lineStyle: library.LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      title: "Invested",
    })
    investedSeries.setData(
      shown.map((point) => ({ time: point.date, value: point.invested })),
    )
    seriesRef.current = [valueSeries, investedSeries]
    chart.timeScale().fitContent()
  }, [ready, shown, resolvedTheme])

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {last ? formatINR(last.value, 0) : "—"}
            {last && (
              <span className="ml-2 text-sm font-normal tracking-normal text-muted-foreground">
                on {shortDate.format(new Date(last.date))}
              </span>
            )}
          </p>
          {first && last && first !== last && (
            <p
              className={cn(
                "text-sm font-medium",
                toneTextClass(toneOf(change - newMoney)),
              )}
            >
              {formatSignedINR(change, 0)} {words}
              <span className="font-normal text-muted-foreground">
                {newMoney !== 0 &&
                  ` · ${formatSignedINR(newMoney, 0)} of it new money`}
              </span>
            </p>
          )}
        </div>
        <div
          role="group"
          aria-label="Chart range"
          className="flex rounded-lg bg-muted p-0.5"
        >
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={range === item.key}
              onClick={() => setRange(item.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-sm font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
                range === item.key && "bg-card text-foreground shadow-xs",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={containerRef}
        className="h-56 w-full"
        role="img"
        aria-label={
          first && last
            ? `Family value from ${formatINR(first.value, 0)} on ${dateFormat.format(new Date(first.date))} to ${formatINR(last.value, 0)} on ${dateFormat.format(new Date(last.date))}`
            : "No history yet"
        }
      />
      <p className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-primary" /> Value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-muted-foreground" />{" "}
          Money invested
        </span>
      </p>
    </div>
  )
}
