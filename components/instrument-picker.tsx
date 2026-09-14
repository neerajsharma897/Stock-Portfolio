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

export type PickedInstrument = {
  id: number
  symbol: string
  exchange: string
  kind: string
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 250

/** Searchable stock picker. Submits the chosen instrument id in a hidden input. */
export function InstrumentPicker({
  name,
  defaultValue,
  search,
  triggerProps,
}: {
  name: string
  defaultValue?: PickedInstrument
  search: (query: string) => Promise<PickedInstrument[]>
  triggerProps: {
    id: string
    "aria-invalid": boolean
    "aria-describedby"?: string
  }
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PickedInstrument | null>(
    defaultValue ?? null,
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickedInstrument[]>([])
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
      ? "Type at least 2 letters of the symbol."
      : "No matching stock. If it's newly listed, update the stock list in Settings."

  return (
    <>
      <input type="hidden" name={name} value={selected?.id ?? ""} />
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
                  · {selected.exchange}
                </span>
              </span>
            ) : (
              <span className="text-muted-foreground">Search by symbol…</span>
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
              placeholder="e.g. RELIANCE, TCS, NIFTYBEES"
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
                      key={item.id}
                      value={String(item.id)}
                      onSelect={() => {
                        setSelected(item)
                        setOpen(false)
                      }}
                    >
                      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                        <span className="truncate font-medium">
                          {item.symbol}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {item.exchange}
                          {item.kind === "sgb" && " · Gold bond"}
                        </span>
                      </span>
                      {selected?.id === item.id && <CheckIcon aria-hidden />}
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
