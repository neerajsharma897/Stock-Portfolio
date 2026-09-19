"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveDeposit } from "@/app/(app)/members/other-asset-actions"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { FormState } from "@/lib/action-state"
import { todayInIndia } from "@/lib/dates"
import {
  FD_INTEREST_LABELS,
  FD_INTERESTS,
  type FdInterest,
} from "@/lib/other-assets/options"

export type EditableDeposit = {
  id: string
  bank: string
  principal: number
  ratePct: number
  interest: FdInterest
  startDate: string
  maturityDate: string
  closedOn: string | null
  notes: string | null
}

/** "Add FD" button, or an edit icon when an FD is passed. */
export function DepositDialog({
  memberId,
  deposit,
}: {
  memberId: string
  deposit?: EditableDeposit
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {deposit ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit the ${deposit.bank} FD`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            Add FD
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {deposit ? "Edit fixed deposit" : "Add fixed deposit"}
          </DialogTitle>
          <DialogDescription>
            Copy the details from the FD receipt or the bank app. Its value
            today is worked out from the rate.
          </DialogDescription>
        </DialogHeader>
        <DepositForm
          memberId={memberId}
          deposit={deposit}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function DepositForm({
  memberId,
  deposit,
  onSaved,
}: {
  memberId: string
  deposit?: EditableDeposit
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveDeposit(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}
  const today = todayInIndia()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="memberId" value={memberId} />
      {deposit && <input type="hidden" name="id" value={deposit.id} />}

      <FormField id="deposit-bank" label="Bank" error={errors.bank?.[0]}>
        {(props) => (
          <Input
            {...props}
            name="bank"
            autoComplete="off"
            maxLength={60}
            placeholder="e.g. SBI"
            defaultValue={deposit?.bank ?? ""}
            required
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="deposit-principal"
          label="Amount deposited (₹)"
          error={errors.principal?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="principal"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={deposit ? String(deposit.principal) : ""}
              required
            />
          )}
        </FormField>
        <FormField
          id="deposit-rate"
          label="Interest rate (% a year)"
          error={errors.ratePct?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="ratePct"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 7.1"
              defaultValue={deposit ? String(deposit.ratePct) : ""}
              required
            />
          )}
        </FormField>
      </div>

      <FormField
        id="deposit-interest"
        label="Interest"
        hint="Most FDs that pay at maturity compound quarterly."
        error={errors.interest?.[0]}
      >
        {(props) => (
          <Select
            name="interest"
            defaultValue={deposit?.interest ?? "quarterly"}
          >
            <SelectTrigger {...props} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FD_INTERESTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {FD_INTEREST_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="deposit-start"
          label="Start date"
          error={errors.startDate?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              name="startDate"
              max={today}
              defaultValue={deposit?.startDate ?? today}
              required
            />
          )}
        </FormField>
        <FormField
          id="deposit-maturity"
          label="Maturity date"
          error={errors.maturityDate?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              name="maturityDate"
              defaultValue={deposit?.maturityDate ?? ""}
              required
            />
          )}
        </FormField>
      </div>

      <FormField
        id="deposit-closed"
        label="Closed on"
        hint="Leave blank while the FD is running. Closed FDs leave the totals."
        error={errors.closedOn?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            type="date"
            name="closedOn"
            max={today}
            defaultValue={deposit?.closedOn ?? ""}
          />
        )}
      </FormField>

      <FormField id="deposit-notes" label="Notes" error={errors.notes?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="notes"
            defaultValue={deposit?.notes ?? ""}
            maxLength={500}
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
          {pending ? "Saving…" : deposit ? "Save" : "Add FD"}
        </Button>
      </DialogFooter>
    </form>
  )
}
