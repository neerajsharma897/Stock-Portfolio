"use client"

import { PencilIcon, RefreshCwIcon } from "lucide-react"
import { startTransition, useActionState, useState, useTransition } from "react"
import { toast } from "sonner"

import { setStockSector, updateSectors } from "@/app/(app)/stocks/actions"
import { FormField } from "@/components/form-field"
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
import { NSE_SECTORS } from "@/lib/sectors/names"
import { showResult } from "@/lib/show-result"
import { cn } from "@/lib/utils"

export function UpdateSectorsButton({ loaded }: { loaded: boolean }) {
  const [pending, startUpdate] = useTransition()
  return (
    <Button
      size="sm"
      variant={loaded ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        startUpdate(async () => {
          showResult(await updateSectors())
        })
      }
    >
      <RefreshCwIcon className={cn(pending && "animate-spin")} />
      {pending ? "Updating…" : loaded ? "Update sectors" : "Download sectors"}
    </Button>
  )
}

/** Sets the sector of a stock that isn't in NSE's list. */
export function SetSectorDialog({
  symbol,
  sector,
}: {
  symbol: string
  sector: string | null
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await setStockSector(prevState, formData)
      if (result?.status === "success") {
        setOpen(false)
        toast.success(result.message)
      }
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Set the sector of ${symbol}`}
        >
          <PencilIcon />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sector of {symbol}</DialogTitle>
          <DialogDescription>
            Pick one of NSE&apos;s sectors or type your own. The weekly update
            won&apos;t change it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
          <input type="hidden" name="symbol" value={symbol} />
          <FormField
            id="stock-sector"
            label="Sector"
            error={errors.sector?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                name="sector"
                list="nse-sectors"
                defaultValue={sector ?? ""}
                maxLength={60}
                autoComplete="off"
                required
              />
            )}
          </FormField>
          <datalist id="nse-sectors">
            {NSE_SECTORS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
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
      </DialogContent>
    </Dialog>
  )
}
