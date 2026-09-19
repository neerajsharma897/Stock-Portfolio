"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { searchInstrumentsAction } from "@/app/(app)/members/transaction-actions"
import { saveWatchlistItem } from "@/app/(app)/watchlist/actions"
import { FormField } from "@/components/form-field"
import {
  InstrumentPicker,
  type PickedInstrument,
} from "@/components/instrument-picker"
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
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { FormState } from "@/lib/action-state"

type EditableItem = { instrument: PickedInstrument; note: string | null }

/** "Add stock" button for a watchlist, or an edit icon for an item's note. */
export function WatchlistItemDialog({
  watchlistId,
  watchlistName,
  item,
}: {
  watchlistId: string
  watchlistName: string
  item?: EditableItem
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {item ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit note for ${item.instrument.symbol}`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            Add stock
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {item
              ? `Edit ${item.instrument.symbol}`
              : `Add to ${watchlistName}`}
          </DialogTitle>
          <DialogDescription>
            Follow a stock&apos;s price, chart and news without holding it.
          </DialogDescription>
        </DialogHeader>
        <WatchlistItemForm
          watchlistId={watchlistId}
          item={item}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function WatchlistItemForm({
  watchlistId,
  item,
  onSaved,
}: {
  watchlistId: string
  item?: EditableItem
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveWatchlistItem(prevState, formData)
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
      <input type="hidden" name="watchlistId" value={watchlistId} />
      {item ? (
        <div className="grid gap-2">
          <Label>Stock</Label>
          <input type="hidden" name="instrumentId" value={item.instrument.id} />
          <p className="text-sm">
            <span className="font-medium">{item.instrument.symbol}</span>
            <span className="text-muted-foreground">
              {" "}
              · {item.instrument.exchange}
            </span>
          </p>
        </div>
      ) : (
        <FormField
          id="watchlist-stock"
          label="Stock"
          error={errors.instrumentId?.[0]}
        >
          {(props) => (
            <InstrumentPicker
              name="instrumentId"
              search={searchInstrumentsAction}
              triggerProps={props}
            />
          )}
        </FormField>
      )}

      <FormField
        id="watchlist-note"
        label="Note"
        hint="Optional, e.g. the price you'd buy at."
        error={errors.note?.[0]}
      >
        {(props) => (
          <Textarea
            {...props}
            name="note"
            defaultValue={item?.note ?? ""}
            maxLength={200}
            rows={2}
          />
        )}
      </FormField>

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
          {pending ? "Saving…" : item ? "Save" : "Add stock"}
        </Button>
      </DialogFooter>
    </form>
  )
}
