import { ExternalLinkIcon, NewspaperIcon } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { NewsRefresher } from "@/app/(app)/news/news-refresher"
import { SearchNameDialog } from "@/app/(app)/news/search-name-dialog"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  listNewsArticles,
  listNewsStocks,
  type NewsStock,
} from "@/lib/data/news"
import { newsSearchName } from "@/lib/news/relevance"
import { isNewsDue, NEWS_STALE_MINUTES } from "@/lib/news/refresh"
import { newsTopic } from "@/lib/news/topics"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "News" }

const ALL_LIMIT = 100
const STOCK_LIMIT = 50

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

function parseStockId(value: string | string[] | undefined): number | null {
  return typeof value === "string" && /^\d{1,12}$/.test(value)
    ? Number(value)
    : null
}

function StockFilter({
  stocks,
  selectedId,
}: {
  stocks: NewsStock[]
  selectedId: number | null
}) {
  const chip = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1 text-sm font-medium ring-1 ring-border transition-colors",
      active
        ? "bg-primary text-primary-foreground ring-primary"
        : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
    )

  return (
    <nav
      aria-label="Filter news by stock"
      className="mb-2 flex flex-wrap gap-1.5"
    >
      <Link
        href="/news"
        className={chip(selectedId === null)}
        aria-current={selectedId === null ? "page" : undefined}
      >
        All stocks
      </Link>
      {stocks.map((stock) => (
        <Link
          key={stock.id}
          href={`/news?stock=${stock.id}`}
          className={chip(stock.id === selectedId)}
          aria-current={stock.id === selectedId ? "page" : undefined}
        >
          {stock.symbol}
        </Link>
      ))}
    </nav>
  )
}

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const { stock } = await searchParams
  const stocks = await listNewsStocks()
  const selectedId = parseStockId(stock)
  const selected = stocks.find((item) => item.id === selectedId) ?? null
  const shown = selected ? [selected] : stocks
  const articles = await listNewsArticles(
    shown.map((item) => item.id),
    selected ? STOCK_LIMIT : ALL_LIMIT,
  )
  const due = shown.some((item) =>
    isNewsDue(item.checkedAt, NEWS_STALE_MINUTES),
  )

  const header = (
    <PageHeader
      title="News"
      description="Recent headlines from Google News for stocks the family holds or watches."
    >
      {stocks.length > 0 && (
        <NewsRefresher instrumentId={selected?.id ?? null} due={due} />
      )}
    </PageHeader>
  )

  if (stocks.length === 0) {
    return (
      <>
        {header}
        <Card className="border-dashed">
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <NewspaperIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-medium">No stocks to follow yet</p>
            <p className="max-w-md text-sm text-muted-foreground">
              News shows for stocks the family holds and stocks on the
              watchlist.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline">
                <Link href="/watchlist">Go to watchlist</Link>
              </Button>
              <Button asChild>
                <Link href="/members">Go to members</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      {header}
      <StockFilter stocks={stocks} selectedId={selected?.id ?? null} />

      {selected && (
        <Card className="mb-2">
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-1 text-sm">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{selected.symbol}</span>
                <span className="text-muted-foreground">
                  {selected.exchange}
                </span>
                {selected.held && <Badge variant="secondary">Held</Badge>}
                {selected.watched && <Badge variant="outline">Watchlist</Badge>}
              </p>
              <p className="text-muted-foreground">
                Searching for &ldquo;
                {newsSearchName(selected.symbol, selected.searchName)}&rdquo;
                {selected.checkedAt
                  ? ` · checked ${timeFormatter.format(new Date(selected.checkedAt))}`
                  : ""}
              </p>
              {selected.error && (
                <p className="text-destructive">
                  Last search failed: {selected.error}
                </p>
              )}
            </div>
            <SearchNameDialog
              instrumentId={selected.id}
              symbol={selected.symbol}
              searchName={selected.searchName}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            {selected ? `${selected.symbol} headlines` : "Latest headlines"}
          </CardTitle>
          <CardDescription>
            From the last two weeks, newest first. Labels like
            &ldquo;Results&rdquo; come from keywords in the headline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {articles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {due
                ? "No headlines saved yet. Checking Google News now…"
                : selected
                  ? "No recent headlines mention this stock. Try a company name with Change search."
                  : "No recent headlines for these stocks."}
            </p>
          ) : (
            <ul className="divide-y">
              {articles.map((article) => {
                const topic = newsTopic(article.title)
                return (
                  <li
                    key={article.id}
                    className="grid gap-1 py-3 first:pt-0 last:pb-0"
                  >
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group font-medium underline-offset-4 hover:underline"
                    >
                      {article.title}
                      <ExternalLinkIcon
                        className="ml-1 inline size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {article.source && <span>{article.source}</span>}
                      <time dateTime={article.publishedAt}>
                        {timeFormatter.format(new Date(article.publishedAt))}
                      </time>
                      {topic && <Badge variant="outline">{topic}</Badge>}
                      {!selected &&
                        article.stocks.map((item) => (
                          <Link
                            key={item.id}
                            href={`/news?stock=${item.id}`}
                            className="font-medium text-foreground hover:underline"
                          >
                            {item.symbol}
                          </Link>
                        ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
