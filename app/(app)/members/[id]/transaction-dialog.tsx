"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import {
  saveTransaction,
  searchInstrumentsAction,
} from "@/app/(app)/members/transaction-actions"
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
import { brokerAccountName, type Broker } from "@/lib/members/options"
import type { TransactionType } from "@/lib/portfolio/holdings"
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
} from "@/lib/transactions/options"

export type StockAccount = { id: string; broker: Broker; label: string | null }

export type EditableTransaction = {
  id: string
  type: TransactionType
  broker_account_id: string
  quantity: number
  price: number
  charges: number
  trade_date: string
  notes: string | null
  instrument: PickedInstrument
}

const PRICE_FIELD: Record<TransactionType, { label: string; hint?: string }> = {
  opening_balance: {
    label: "Average buy price (₹)",
    hint: "As shown in the broker app's holdings.",
  },
  buy: { label: "Buy price per share (₹)" },
  sell: { label: "Sell price per share (₹)" },
}

/** "Add transaction" button, or an edit icon when a transaction is passed. */
export function TransactionDialog({
  memberId,
  accounts,
  transaction,
}: {
  memberId: string
  accounts: StockAccount[]
  transaction?: EditableTransaction
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {transaction ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${TRANSACTION_TYPE_LABELS[transaction.type].toLowerCase()} of ${transaction.instrument.symbol}`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            Add transaction
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit transaction" : "Add transaction"}
          </DialogTitle>
          <DialogDescription>
            Use an opening balance for shares already held, then add buys and
            sells as they happen.
          </DialogDescription>
        </DialogHeader>
        <TransactionForm
          memberId={memberId}
          accounts={accounts}
          transaction={transaction}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function TransactionForm({
  memberId,
  accounts,
  transaction,
  onSaved,
}: {
  memberId: string
  accounts: StockAccount[]
  transaction?: EditableTransaction
  onSaved: (message: string) => void
}) {
  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? "opening_balance",
  )
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveTransaction(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}
  const today = todayInIndia()
  const priceField = PRICE_FIELD[type]

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <input type="hidden" name="memberId" value={memberId} />
      {transaction && <input type="hidden" name="id" value={transaction.id} />}

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm leading-none font-medium">Type</legend>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {TRANSACTION_TYPES.map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="type"
                value={value}
                checked={type === value}
                onChange={() => setType(value)}
                className="peer sr-only"
              />
              <span className="block rounded-md px-2 py-1.5 text-center text-sm font-medium text-muted-foreground peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-xs peer-focus-visible:ring-2 peer-focus-visible:ring-ring">
                {TRANSACTION_TYPE_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        id="transaction-account"
        label="Account"
        error={errors.brokerAccountId?.[0]}
      >
        {(props) => (
          <Select
            name="brokerAccountId"
            defaultValue={
              transaction?.broker_account_id ??
              (accounts.length === 1 ? accounts[0].id : undefined)
            }
          >
            <SelectTrigger {...props} className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {brokerAccountName(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <FormField
        id="transaction-stock"
        label="Stock"
        error={errors.instrumentId?.[0]}
      >
        {(props) => (
          <InstrumentPicker
            name="instrumentId"
            defaultValue={transaction?.instrument}
            search={searchInstrumentsAction}
            triggerProps={props}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="transaction-date"
          label={type === "opening_balance" ? "As of date" : "Trade date"}
          error={errors.tradeDate?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              name="tradeDate"
              max={today}
              defaultValue={transaction?.trade_date ?? today}
              required
            />
          )}
        </FormField>

        <FormField
          id="transaction-quantity"
          label="Quantity"
          error={errors.quantity?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="quantity"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={transaction ? String(transaction.quantity) : ""}
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="transaction-price"
          label={priceField.label}
          hint={priceField.hint}
          error={errors.price?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="price"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={transaction ? String(transaction.price) : ""}
              required
            />
          )}
        </FormField>

        {type !== "opening_balance" && (
          <FormField
            id="transaction-charges"
            label="Charges (₹)"
            hint="Optional. Brokerage, STT and fees."
            error={errors.charges?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                name="charges"
                inputMode="decimal"
                autoComplete="off"
                defaultValue={
                  transaction?.charges ? String(transaction.charges) : ""
                }
              />
            )}
          </FormField>
        )}
      </div>

      <FormField id="transaction-notes" label="Notes" error={errors.notes?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="notes"
            defaultValue={transaction?.notes ?? ""}
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
          {pending ? "Saving…" : transaction ? "Save" : "Add transaction"}
        </Button>
      </DialogFooter>
    </form>
  )
}
