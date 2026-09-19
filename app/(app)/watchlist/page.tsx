import { EyeIcon, NewspaperIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { DeleteWatchlistButton } from "@/app/(app)/watchlist/delete-watchlist-button"
import { RemoveWatchlistButton } from "@/app/(app)/watchlist/remove-watchlist-button"
import { WatchlistFormDialog } from "@/app/(app)/watchlist/watchlist-form-dialog"
import { WatchlistItemDialog } from "@/app/(app)/watchlist/watchlist-item-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { LivePrices } from "@/components/live-prices"
import { StockChartDialog } from "@/components/stock-chart-dialog"
import { toneTextClass } from "@/components/stat-tile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UpdatePricesDialog } from "@/components/update-prices-dialog"
import { listNewsStocks } from "@/lib/data/news"
import { listWatchlists } from "@/lib/data/watchlist"
import { formatDate, formatINR, formatPercent } from "@/lib/format"
import type { PriceItem } from "@/lib/portfolio/valuation"
import { getLiveStatus } from "@/lib/prices/live"
import { cn } from "@/lib/utils"
import { MAX_WATCHLIST_STOCKS, MAX_WATCHLISTS } from "@/lib/watchlist/schema"

export const metadata: Metadata = { title: "Watchlists" }

function percentChange(lastPrice: number, previousClose: number | null) {
  return previousClose === null
    ? null
    : ((lastPrice - previousClose) / previousClose) * 100
}

export default async function WatchlistPage({
  searchParams,
}: PageProps<"/watchlist">) {
  const { list } = await searchParams
  const [watchlists, newsStocks, liveStatus] = await Promise.all([
    listWatchlists(),
    listNewsStocks(),
    getLiveStatus(),
  ])
  const selected =
    watchlists.find((watchlist) => watchlist.id === list) ??
    watchlists[0] ??
    null
  const heldIds = new Set(
    newsStocks.filter((stock) => stock.held).map((stock) => stock.id),
  )
  const items = selected?.items ?? []
  const priceItems: PriceItem[] = items.map(({ instrument, price }) => ({
    instrumentId: instrument.id,
    symbol: instrument.symbol,
    exchange: instrument.exchange,
    lastPrice: price?.lastPrice ?? null,
    previousClose: price?.previousClose ?? null,
    pricedAt: price?.pricedAt ?? null,
  }))
  const canAddList = watchlists.length < MAX_WATCHLISTS

  return (
    <>
      <PageHeader
        title="Watchlists"
        description={`Up to ${MAX_WATCHLISTS} lists of stocks to follow, with live prices, charts and news.`}
      >
        <div className="flex flex-wrap items-center gap-3">
          {items.length > 0 && <LivePrices initialStatus={liveStatus} />}
          <UpdatePricesDialog items={priceItems} />
        </div>
      </PageHeader>

      {watchlists.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <EyeIcon className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-medium">No watchlists yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Make a list, e.g. &ldquo;Banks&rdquo; or &ldquo;To buy&rdquo;, and
              add stocks you&apos;re following. They get live prices and charts,
              and their news shows on the News page.
            </p>
            <WatchlistFormDialog />
          </CardContent>
        </Card>
      ) : (
        <>
          <nav
            aria-label="Watchlists"
            className="mb-2 flex flex-wrap items-center gap-1.5"
          >
            {watchlists.map((watchlist) => {
              const active = watchlist.id === selected?.id
              return (
                <Link
                  key={watchlist.id}
                  href={`/watchlist?list=${watchlist.id}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-border transition-colors",
                    active
                      ? "bg-primary text-primary-foreground ring-primary"
                      : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {watchlist.name}
                  <span
                    className={cn(
                      "ml-1.5 tabular-nums",
                      active ? "opacity-80" : "text-muted-foreground",
                    )}
                  >
                    {watchlist.items.length}
                  </span>
                </Link>
              )
            })}
            {canAddList ? (
              <WatchlistFormDialog />
            ) : (
              <span className="text-xs text-muted-foreground">
                {MAX_WATCHLISTS} lists is the most; delete one to add another.
              </span>
            )}
          </nav>

          {selected && (
            <Card>
              <CardHeader>
                <CardTitle>{selected.name}</CardTitle>
                <CardDescription>
                  {items.length === 0
                    ? "No stocks yet."
                    : `${items.length} ${items.length === 1 ? "stock" : "stocks"} · tap a symbol for its chart · today's change is since the previous close`}
                </CardDescription>
                <CardAction className="flex flex-wrap justify-end gap-1">
                  {items.length < MAX_WATCHLIST_STOCKS && (
                    <WatchlistItemDialog
                      watchlistId={selected.id}
                      watchlistName={selected.name}
                    />
                  )}
                  <WatchlistFormDialog
                    list={{ id: selected.id, name: selected.name }}
                  />
                  <DeleteWatchlistButton
                    watchlistId={selected.id}
                    name={selected.name}
                    stockCount={items.length}
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Add stocks you&apos;re thinking of buying. They get live
                    prices like the family&apos;s holdings.
                  </p>
                ) : (
                  <div className="-mx-4 overflow-x-auto">
                    <table className="w-full min-w-[600px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th scope="col" className="px-4 py-2 font-medium">
                            Stock
                          </th>
                          <th
                            scope="col"
                            className="px-4 py-2 text-right font-medium"
                          >
                            Last price
                          </th>
                          <th scope="col" className="px-4 py-2 font-medium">
                            Note
                          </th>
                          <th scope="col" className="px-4 py-2">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map(({ instrument, note, addedAt, price }) => {
                          const change = price
                            ? percentChange(
                                price.lastPrice,
                                price.previousClose,
                              )
                            : null
                          return (
                            <tr key={instrument.id}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <StockChartDialog
                                    instrumentId={instrument.id}
                                    symbol={instrument.symbol}
                                    exchange={instrument.exchange}
                                    previousClose={price?.previousClose ?? null}
                                    livePrice={
                                      price
                                        ? {
                                            lastPrice: price.lastPrice,
                                            pricedAt: price.pricedAt,
                                          }
                                        : null
                                    }
                                    marketOpen={liveStatus.market.open}
                                  />
                                  {heldIds.has(instrument.id) && (
                                    <Badge variant="secondary">Held</Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {instrument.exchange}
                                  {instrument.kind === "sgb" &&
                                    " · Gold bond"}{" "}
                                  · added {formatDate(addedAt)}
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-right tabular-nums">
                                {price ? (
                                  <>
                                    <div>{formatINR(price.lastPrice)}</div>
                                    {change !== null && (
                                      <div
                                        className={cn(
                                          "text-xs",
                                          toneTextClass(
                                            change > 0
                                              ? "gain"
                                              : change < 0
                                                ? "loss"
                                                : "neutral",
                                          ),
                                        )}
                                      >
                                        {formatPercent(change)}
                                        <span className="sr-only"> today</span>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                    <span className="sr-only">
                                      no price yet
                                    </span>
                                  </span>
                                )}
                              </td>
                              <td className="max-w-64 px-4 py-2.5 text-muted-foreground">
                                {note ?? "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    asChild
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label={`News for ${instrument.symbol}`}
                                  >
                                    <Link href={`/news?stock=${instrument.id}`}>
                                      <NewspaperIcon />
                                    </Link>
                                  </Button>
                                  <WatchlistItemDialog
                                    watchlistId={selected.id}
                                    watchlistName={selected.name}
                                    item={{
                                      instrument: {
                                        id: instrument.id,
                                        symbol: instrument.symbol,
                                        exchange: instrument.exchange,
                                        kind: instrument.kind,
                                      },
                                      note,
                                    }}
                                  />
                                  <RemoveWatchlistButton
                                    watchlistId={selected.id}
                                    watchlistName={selected.name}
                                    instrumentId={instrument.id}
                                    symbol={instrument.symbol}
                                  />
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  )
}
