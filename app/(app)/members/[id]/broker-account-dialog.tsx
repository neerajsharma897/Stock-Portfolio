"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveBrokerAccount } from "@/app/(app)/members/actions"
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
import {
  BROKER_LABELS,
  BROKERS,
  brokerAccountName,
  type Broker,
} from "@/lib/members/options"

export type EditableBrokerAccount = {
  id: string
  broker: Broker
  label: string | null
  client_id_last4: string | null
  notes: string | null
}

/** "Add account" button, or an edit icon when an account is passed. */
export function BrokerAccountDialog({
  memberId,
  account,
}: {
  memberId: string
  account?: EditableBrokerAccount
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {account ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${brokerAccountName(account)} account`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm" variant="outline">
            <PlusIcon />
            Add account
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {account
              ? `Edit ${brokerAccountName(account)} account`
              : "Add account"}
          </DialogTitle>
          <DialogDescription>
            A broker or exchange account. Only the last 4 characters of the
            client ID are saved.
          </DialogDescription>
        </DialogHeader>
        <BrokerAccountForm
          memberId={memberId}
          account={account}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function BrokerAccountForm({
  memberId,
  account,
  onSaved,
}: {
  memberId: string
  account?: EditableBrokerAccount
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveBrokerAccount(prevState, formData)
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
      <input type="hidden" name="memberId" value={memberId} />
      {account && <input type="hidden" name="id" value={account.id} />}

      <FormField id="account-broker" label="Broker" error={errors.broker?.[0]}>
        {(props) => (
          <Select name="broker" defaultValue={account?.broker}>
            <SelectTrigger {...props} className="w-full">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {BROKERS.map((broker) => (
                <SelectItem key={broker} value={broker}>
                  {BROKER_LABELS[broker]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <FormField
        id="account-label"
        label="Label"
        hint='Optional. Only needed for two accounts at the same broker, e.g. "Joint".'
        error={errors.label?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            name="label"
            defaultValue={account?.label ?? ""}
            maxLength={40}
            autoComplete="off"
          />
        )}
      </FormField>

      <FormField
        id="account-client-id"
        label="Client ID (last 4 characters)"
        hint="Optional, e.g. 4521. Helps tell accounts apart."
        error={errors.clientIdLast4?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            name="clientIdLast4"
            defaultValue={account?.client_id_last4 ?? ""}
            maxLength={4}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-28 uppercase"
          />
        )}
      </FormField>

      <FormField id="account-notes" label="Notes" error={errors.notes?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="notes"
            defaultValue={account?.notes ?? ""}
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
          {pending ? "Saving…" : account ? "Save" : "Add account"}
        </Button>
      </DialogFooter>
    </form>
  )
}
