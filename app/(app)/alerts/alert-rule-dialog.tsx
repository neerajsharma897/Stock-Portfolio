"use client"

import { PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveAlertRule } from "@/app/(app)/alerts/actions"
import { searchInstrumentsAction } from "@/app/(app)/members/transaction-actions"
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
  ALERT_KIND_LABELS,
  ALERT_KINDS,
  THRESHOLD_UNIT,
  type AlertKind,
} from "@/lib/alerts/rules"

export function AlertRuleDialog() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon />
          Add price alert
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a price alert</DialogTitle>
          <DialogDescription>
            A Telegram message when it happens, at most once a day per alert.
          </DialogDescription>
        </DialogHeader>
        <AlertRuleForm
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function AlertRuleForm({ onSaved }: { onSaved: (message: string) => void }) {
  const [kind, setKind] = useState<AlertKind>("price_above")
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveAlertRule(prevState, formData)
      if (result?.status === "success") onSaved(result.message)
      return result
    },
    undefined,
  )
  const errors = state?.status === "error" ? (state.fieldErrors ?? {}) : {}
  const unit = THRESHOLD_UNIT[kind]

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    startTransition(() => formAction(formData))
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <FormField
        id="alert-stock"
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

      <FormField id="alert-kind" label="Alert when" error={errors.kind?.[0]}>
        {(props) => (
          <Select
            name="kind"
            value={kind}
            onValueChange={(value) => setKind(value as AlertKind)}
          >
            <SelectTrigger {...props} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ALERT_KINDS.map((value) => (
                <SelectItem key={value} value={value}>
                  {ALERT_KIND_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      {unit && (
        <FormField
          id="alert-threshold"
          label={unit === "percent" ? "Move (%)" : "Price (₹)"}
          hint={
            unit === "percent"
              ? "Up or down from the previous close, e.g. 4."
              : undefined
          }
          error={errors.threshold?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              key={unit}
              name="threshold"
              inputMode="decimal"
              autoComplete="off"
              required
            />
          )}
        </FormField>
      )}
      {!unit && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Uses the 52-week range from Angel One&apos;s live prices.
        </p>
      )}

      <FormField id="alert-note" label="Note" error={errors.note?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="note"
            maxLength={200}
            rows={2}
            placeholder="Optional, e.g. why this level matters"
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
          {pending ? "Saving…" : "Add alert"}
        </Button>
      </DialogFooter>
    </form>
  )
}
