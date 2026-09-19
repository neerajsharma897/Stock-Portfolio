"use client"

import { ChartLineIcon } from "lucide-react"

import { StockChart, type LivePrice } from "@/components/stock-chart"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/** The stock's symbol as a button that opens its price chart. */
export function StockChartDialog({
  instrumentId,
  symbol,
  exchange,
  previousClose,
  livePrice,
  marketOpen,
}: {
  instrumentId: number
  symbol: string
  exchange: string
  previousClose: number | null
  livePrice: LivePrice | null
  marketOpen: boolean
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {symbol}
          <ChartLineIcon
            className="size-3.5 text-muted-foreground"
            aria-hidden
          />
          <span className="sr-only"> chart</span>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {symbol}
            <span className="font-normal text-muted-foreground">
              {" "}
              · {exchange}
            </span>
          </DialogTitle>
          <DialogDescription>
            Price chart. Pick a range, or switch between line and candles.
          </DialogDescription>
        </DialogHeader>
        <StockChart
          instrumentId={instrumentId}
          symbol={symbol}
          previousClose={previousClose}
          livePrice={livePrice}
          marketOpen={marketOpen}
        />
      </DialogContent>
    </Dialog>
  )
}
