"use client"

import { CheckIcon, ChevronsUpDownIcon } from "lucide-react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatPriceINR } from "@/lib/format"

export type PickedCoin = {
  market: string
  symbol: string
  name: string
  last_price: number | null
  priced_at: string | null
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250

/** Searchable coin picker. Submits the CoinDCX market (e.g. BTCINR) in a hidden input. */
export function CoinPicker({
  name,
  defaultValue,
  search,
  onSelect,
  triggerProps,
}: {
  name: string
  defaultValue?: PickedCoin
  search: (query: string) => Promise<PickedCoin[]>
  onSelect?: (coin: PickedCoin) => void
  triggerProps: {
    id: string
    "aria-invalid": boolean
    "aria-describedby"?: string
  }
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PickedCoin | null>(
    defaultValue ?? null,
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickedCoin[]>([])
  const [loading, setLoading] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const latestRequest = useRef(0)

  function handleQueryChange(value: string) {
    setQuery(value)
    clearTimeout(timer.current)
    if (value.trim().length < MIN_QUERY_LENGTH) {
      latestRequest.current += 1
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    timer.current = setTimeout(async () => {
      const requestId = ++latestRequest.current
      try {
        const items = await search(value)
        if (requestId === latestRequest.current) setResults(items)
      } catch {
        if (requestId === latestRequest.current) setResults([])
      } finally {
        if (requestId === latestRequest.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
  }

  const emptyMessage =
    query.trim().length < MIN_QUERY_LENGTH
      ? "Type at least 2 letters of the symbol or name."
      : "No matching coin. Only coins traded for rupees on CoinDCX are listed; update the coin list in Settings if it's new."

  return (
    <>
      <input type="hidden" name={name} value={selected?.market ?? ""} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            {...triggerProps}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            {selected ? (
              <span className="truncate">
                {selected.symbol}
                <span className="text-muted-foreground">
                  {" "}
                  · {selected.name}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Search by symbol or name…
              </span>
            )}
            <ChevronsUpDownIcon className="opacity-50" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="e.g. BTC, ETH, Bitcoin"
              value={query}
              onValueChange={handleQueryChange}
            />
            <CommandList>
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Searching…
                </p>
              ) : (
                <CommandEmpty>{emptyMessage}</CommandEmpty>
              )}
              {!loading && results.length > 0 && (
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={item.market}
                      value={item.market}
                      onSelect={() => {
                        setSelected(item)
                        onSelect?.(item)
                        setOpen(false)
                      }}
                    >
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{item.symbol}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {item.name}
                          </span>
                        </span>
                        {item.last_price !== null && (
                          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                            {formatPriceINR(item.last_price)}
                          </span>
                        )}
                      </span>
                      {selected?.market === item.market && (
                        <CheckIcon aria-hidden />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  )
}
