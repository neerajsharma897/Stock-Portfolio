"use client"

import { PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { searchInstrumentsAction } from "@/app/(app)/members/transaction-actions"
import { saveCorporateAction } from "@/app/(app)/settings/corporate-action-actions"
import { FormField } from "@/components/form-field"
import { InstrumentPicker } from "@/components/instrument-picker"
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
import { Textarea } from "@/components/ui/textarea"
import type { FormState } from "@/lib/action-state"
import {
  CORPORATE_ACTION_KINDS,
  CORPORATE_ACTION_LABELS,
  type CorporateActionKind,
} from "@/lib/corporate-actions/schema"
import { todayInIndia } from "@/lib/dates"

export function CorporateActionDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="w-fit">
          <PlusIcon />
          Add split or bonus
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a split or bonus</DialogTitle>
          <DialogDescription>
            Every family holding of the stock is adjusted from the ex-date.
            Enter prices after the ex-date at the new, lower price.
          </DialogDescription>
        </DialogHeader>
        <CorporateActionForm
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function CorporateActionForm({
  onSaved,
}: {
  onSaved: (message: string) => void
}) {
  const [kind, setKind] = useState<CorporateActionKind>("split")
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveCorporateAction(prevState, formData)
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

  const split = kind === "split"

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField
        id="corporate-action-stock"
        label="Stock"
        hint="Add it for each exchange the family holds it on (NSE and BSE are separate)."
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

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">Type</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {CORPORATE_ACTION_KINDS.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="peer sr-only"
              />
              <span className="block rounded-md px-2 py-1.5 text-center text-sm font-medium text-muted-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-xs peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {CORPORATE_ACTION_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        {split ? (
          <>
            <FormField
              id="corporate-action-from"
              label="Old shares"
              error={errors.ratioFrom?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="ratioFrom"
                  inputMode="numeric"
                  defaultValue="1"
                  required
                />
              )}
            </FormField>
            <FormField
              id="corporate-action-to"
              label="Become new shares"
              error={errors.ratioTo?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="ratioTo"
                  inputMode="numeric"
                  placeholder="5"
                  required
                />
              )}
            </FormField>
          </>
        ) : (
          <>
            <FormField
              id="corporate-action-to"
              label="Bonus shares"
              error={errors.ratioTo?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="ratioTo"
                  inputMode="numeric"
                  defaultValue="1"
                  required
                />
              )}
            </FormField>
            <FormField
              id="corporate-action-from"
              label="For every … held"
              error={errors.ratioFrom?.[0]}
            >
              {(props) => (
                <Input
                  {...props}
                  name="ratioFrom"
                  inputMode="numeric"
                  defaultValue="1"
                  required
                />
              )}
            </FormField>
          </>
        )}
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        {split
          ? "A split from ₹10 to ₹2 face value is 1 → 5."
          : "A 1:1 bonus gives 1 new share for every 1 held. Part shares are paid in cash, so only whole shares are added."}
      </p>

      <FormField
        id="corporate-action-date"
        label="Ex-date"
        hint="The first day the shares trade at the new price."
        error={errors.exDate?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            type="date"
            name="exDate"
            defaultValue={todayInIndia()}
            required
          />
        )}
      </FormField>

      <FormField
        id="corporate-action-notes"
        label="Notes"
        error={errors.notes?.[0]}
      >
        {(props) => (
          <Textarea {...props} name="notes" maxLength={200} rows={2} />
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
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  )
}
