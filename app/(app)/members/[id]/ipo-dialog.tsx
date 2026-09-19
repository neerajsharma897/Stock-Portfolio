"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveIpo } from "@/app/(app)/members/other-asset-actions"
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
  IPO_STATUS_LABELS,
  IPO_STATUSES,
  type IpoStatus,
} from "@/lib/other-assets/options"

export type EditableIpo = {
  id: string
  company: string
  appliedOn: string
  sharesApplied: number
  price: number
  status: IpoStatus
  sharesAllotted: number | null
  notes: string | null
}

/** "Add IPO" button, or an edit icon when an application is passed. */
export function IpoDialog({
  memberId,
  ipo,
}: {
  memberId: string
  ipo?: EditableIpo
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {ipo ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit the ${ipo.company} IPO application`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            Add IPO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {ipo ? "Edit IPO application" : "Add IPO application"}
          </DialogTitle>
          <DialogDescription>
            Keeps track of bids and allotments. Once allotted shares list, add
            them as a stock buy at the issue price.
          </DialogDescription>
        </DialogHeader>
        <IpoForm
          memberId={memberId}
          ipo={ipo}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function IpoForm({
  memberId,
  ipo,
  onSaved,
}: {
  memberId: string
  ipo?: EditableIpo
  onSaved: (message: string) => void
}) {
  const [status, setStatus] = useState<IpoStatus>(ipo?.status ?? "applied")
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveIpo(prevState, formData)
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
      {ipo && <input type="hidden" name="id" value={ipo.id} />}

      <FormField id="ipo-company" label="Company" error={errors.company?.[0]}>
        {(props) => (
          <Input
            {...props}
            name="company"
            autoComplete="off"
            maxLength={80}
            defaultValue={ipo?.company ?? ""}
            required
          />
        )}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="ipo-shares"
          label="Shares applied for"
          error={errors.sharesApplied?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="sharesApplied"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={ipo ? String(ipo.sharesApplied) : ""}
              required
            />
          )}
        </FormField>
        <FormField
          id="ipo-price"
          label="Price per share (₹)"
          hint="Usually the top of the price band."
          error={errors.price?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="price"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={ipo ? String(ipo.price) : ""}
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="ipo-applied-on"
          label="Applied on"
          error={errors.appliedOn?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              type="date"
              name="appliedOn"
              max={today}
              defaultValue={ipo?.appliedOn ?? today}
              required
            />
          )}
        </FormField>
        <FormField id="ipo-status" label="Status" error={errors.status?.[0]}>
          {(props) => (
            <Select
              name="status"
              value={status}
              onValueChange={(value) => setStatus(value as IpoStatus)}
            >
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IPO_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {IPO_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      </div>

      {status === "allotted" && (
        <FormField
          id="ipo-allotted"
          label="Shares allotted"
          error={errors.sharesAllotted?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="sharesAllotted"
              inputMode="numeric"
              autoComplete="off"
              defaultValue={
                ipo?.sharesAllotted ? String(ipo.sharesAllotted) : ""
              }
              required
            />
          )}
        </FormField>
      )}

      <FormField id="ipo-notes" label="Notes" error={errors.notes?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="notes"
            defaultValue={ipo?.notes ?? ""}
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
          {pending ? "Saving…" : ipo ? "Save" : "Add IPO"}
        </Button>
      </DialogFooter>
    </form>
  )
}
