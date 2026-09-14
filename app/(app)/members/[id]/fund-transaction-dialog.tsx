"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import {
  saveFundTransaction,
  searchFundsAction,
} from "@/app/(app)/members/fund-actions"
import type { StockAccount } from "@/app/(app)/members/[id]/transaction-dialog"
import { FormField } from "@/components/form-field"
import { FundPicker, type PickedFund } from "@/components/fund-picker"
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
import { formatDate, formatINR } from "@/lib/format"
import { brokerAccountName } from "@/lib/members/options"
import {
  MF_TRANSACTION_LABELS,
  MF_TRANSACTION_TYPES,
  type MfTransactionType,
} from "@/lib/mutual-funds/options"

export type EditableFundTransaction = {
  id: string
  type: MfTransactionType
  broker_account_id: string
  folio_number: string | null
  units: number
  nav: number
  charges: number
  trade_date: string
  notes: string | null
  fund: PickedFund
}

const NAV_FIELD: Record<MfTransactionType, { label: string; hint: string }> = {
  opening_balance: {
    label: "Average NAV (₹)",
    hint: "Amount invested ÷ units, from the platform's holdings.",
  },
  purchase: {
    label: "Purchase NAV (₹)",
    hint: "From the order confirmation or statement.",
  },
  sip: {
    label: "SIP NAV (₹)",
    hint: "From the SIP confirmation or statement.",
  },
  redemption: {
    label: "Redemption NAV (₹)",
    hint: "From the redemption confirmation.",
  },
}

/** "Add fund" button, or an edit icon when an entry is passed. */
export function FundTransactionDialog({
  memberId,
  accounts,
  transaction,
}: {
  memberId: string
  accounts: StockAccount[]
  transaction?: EditableFundTransaction
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {transaction ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${MF_TRANSACTION_LABELS[transaction.type].toLowerCase()} of ${transaction.fund.name}`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            Add fund entry
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Edit fund entry" : "Add fund entry"}
          </DialogTitle>
          <DialogDescription>
            Use an opening balance for units already held, then add purchases,
            SIP instalments and redemptions as they happen.
          </DialogDescription>
        </DialogHeader>
        <FundTransactionForm
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

function FundTransactionForm({
  memberId,
  accounts,
  transaction,
  onSaved,
}: {
  memberId: string
  accounts: StockAccount[]
  transaction?: EditableFundTransaction
  onSaved: (message: string) => void
}) {
  const [type, setType] = useState<MfTransactionType>(
    transaction?.type ?? "opening_balance",
  )
  const [fund, setFund] = useState<PickedFund | null>(transaction?.fund ?? null)
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveFundTransaction(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}
  const today = todayInIndia()
  const navField = NAV_FIELD[type]

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
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
          {MF_TRANSACTION_TYPES.map((value) => (
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
                {MF_TRANSACTION_LABELS[value]}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        id="fund-transaction-fund"
        label="Fund"
        hint={
          fund?.nav != null && fund.nav_date
            ? `Latest NAV ${formatINR(fund.nav, 4)} on ${formatDate(fund.nav_date)}.`
            : "Pick the exact plan: Direct or Regular, Growth or IDCW."
        }
        error={errors.amfiCode?.[0]}
      >
        {(props) => (
          <FundPicker
            name="amfiCode"
            defaultValue={transaction?.fund}
            search={searchFundsAction}
            onSelect={setFund}
            triggerProps={props}
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="fund-transaction-account"
          label="Held on"
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
          id="fund-transaction-folio"
          label="Folio number"
          hint="Optional."
          error={errors.folioNumber?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="folioNumber"
              autoComplete="off"
              maxLength={30}
              defaultValue={transaction?.folio_number ?? ""}
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="fund-transaction-date"
          label={type === "opening_balance" ? "As of date" : "Date"}
          hint={
            type === "opening_balance"
              ? "Use the first investment date for a meaningful XIRR."
              : undefined
          }
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
          id="fund-transaction-units"
          label="Units"
          hint="Up to 4 decimals, as on the statement."
          error={errors.units?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="units"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={transaction ? String(transaction.units) : ""}
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="fund-transaction-nav"
          label={navField.label}
          hint={navField.hint}
          error={errors.nav?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="nav"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={transaction ? String(transaction.nav) : ""}
              required
            />
          )}
        </FormField>

        {type !== "opening_balance" && (
          <FormField
            id="fund-transaction-charges"
            label="Stamp duty & charges (₹)"
            hint="Optional."
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

      <FormField
        id="fund-transaction-notes"
        label="Notes"
        error={errors.notes?.[0]}
      >
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
          {pending ? "Saving…" : transaction ? "Save" : "Add entry"}
        </Button>
      </DialogFooter>
    </form>
  )
}
