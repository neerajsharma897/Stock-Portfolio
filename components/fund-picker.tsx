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
import { formatDate, formatINR } from "@/lib/format"
import {
  describeFundPlan,
  type MfOption,
  type MfPlan,
} from "@/lib/mutual-funds/options"

export type PickedFund = {
  amfi_code: number
  name: string
  plan: MfPlan | null
  option_type: MfOption | null
  option_label: string | null
  nav: number | null
  nav_date: string | null
}

const MIN_QUERY_LENGTH = 3
const DEBOUNCE_MS = 300

function fundDetails(fund: PickedFund) {
  return [
    describeFundPlan(fund),
    fund.nav !== null && fund.nav_date
      ? `NAV ${formatINR(fund.nav, 4)} on ${formatDate(fund.nav_date)}`
      : null,
    `Code ${fund.amfi_code}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/** Searchable mutual fund picker. Submits the AMFI code in a hidden input. */
export function FundPicker({
  name,
  defaultValue,
  search,
  onSelect,
  triggerProps,
}: {
  name: string
  defaultValue?: PickedFund
  search: (query: string) => Promise<PickedFund[]>
  onSelect?: (fund: PickedFund) => void
  triggerProps: {
    id: string
    "aria-invalid": boolean
    "aria-describedby"?: string
  }
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<PickedFund | null>(
    defaultValue ?? null,
  )
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PickedFund[]>([])
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
      ? "Type at least 3 letters of the fund name."
      : "No matching fund. Try fewer words, or update the fund list in Settings."

  return (
    <>
      <input type="hidden" name={name} value={selected?.amfi_code ?? ""} />
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
              <span className="truncate">{selected.name}</span>
            ) : (
              <span className="text-muted-foreground">
                Search by fund name…
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
              placeholder="e.g. parag flexi direct, or scheme code"
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
                      key={item.amfi_code}
                      value={String(item.amfi_code)}
                      onSelect={() => {
                        setSelected(item)
                        onSelect?.(item)
                        setOpen(false)
                      }}
                      className="items-start"
                    >
                      <span className="grid min-w-0 flex-1 gap-0.5">
                        <span className="font-medium whitespace-normal">
                          {item.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fundDetails(item)}
                        </span>
                      </span>
                      {selected?.amfi_code === item.amfi_code && (
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
