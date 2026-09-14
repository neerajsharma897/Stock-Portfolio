"use client"

import { IndianRupeeIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { savePrices } from "@/app/(app)/dashboard/actions"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { FormState } from "@/lib/action-state"
import { formatDate } from "@/lib/format"
import type { PriceItem } from "@/lib/portfolio/valuation"

/** Hand-entered prices, for when Angel One live prices aren't set up or need correcting. */
export function UpdatePricesDialog({ items }: { items: PriceItem[] }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <IndianRupeeIcon />
          Update prices
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Update prices</DialogTitle>
          <DialogDescription>
            Copy the last price and previous close from the broker app. Use this
            when live prices aren&apos;t set up, or to correct a price (live
            prices replace it on their next update). Leave a last price blank to
            keep the saved one.
          </DialogDescription>
        </DialogHeader>
        <PricesForm
          items={items}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function PriceInputField({
  name,
  label,
  symbol,
  defaultValue,
  error,
}: {
  name: string
  label: string
  symbol: string
  defaultValue: number | null
  error?: string
}) {
  const id = `${name}-input`
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs text-muted-foreground sm:sr-only">
        {label}
        <span className="sr-only"> for {symbol}</span>
      </label>
      <Input
        id={id}
        name={name}
        inputMode="decimal"
        autoComplete="off"
        defaultValue={defaultValue ?? ""}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className="tabular-nums"
      />
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

function PricesForm({
  items,
  onSaved,
}: {
  items: PriceItem[]
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await savePrices(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="grid gap-3">
        <div
          aria-hidden
          className="hidden grid-cols-[1fr_8rem_8rem] gap-3 text-xs font-medium text-muted-foreground sm:grid"
        >
          <span>Stock</span>
          <span>Last price (₹)</span>
          <span>Previous close (₹)</span>
        </div>

        {items.map((item) => {
          const lastName = `lastPrice-${item.instrumentId}`
          const previousName = `previousClose-${item.instrumentId}`
          const nameId = `price-${item.instrumentId}-name`
          return (
            <div
              key={item.instrumentId}
              role="group"
              aria-labelledby={nameId}
              className="grid gap-2 border-b pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[1fr_8rem_8rem] sm:items-start sm:gap-3"
            >
              <input
                type="hidden"
                name="instrumentId"
                value={item.instrumentId}
              />
              <div className="min-w-0 sm:pt-1.5">
                <p id={nameId} className="truncate font-medium">
                  {item.symbol}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.exchange}
                  {item.pricedAt
                    ? ` · saved ${formatDate(item.pricedAt)}`
                    : " · no price yet"}
                </p>
              </div>
              <PriceInputField
                name={lastName}
                label="Last price (₹)"
                symbol={item.symbol}
                defaultValue={item.lastPrice}
                error={errors[lastName]?.[0]}
              />
              <PriceInputField
                name={previousName}
                label="Previous close (₹)"
                symbol={item.symbol}
                defaultValue={item.previousClose}
                error={errors[previousName]?.[0]}
              />
            </div>
          )
        })}
      </div>

      {state?.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={pending}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save prices"}
        </Button>
      </DialogFooter>
    </form>
  )
}
