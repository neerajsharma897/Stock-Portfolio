"use client"

import { PencilIcon, PlusIcon } from "lucide-react"
import { startTransition, useActionState, useState } from "react"
import { toast } from "sonner"

import { saveOtherAsset } from "@/app/(app)/members/other-asset-actions"
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
  OTHER_ASSET_KINDS,
  OTHER_ASSET_LABELS,
  type OtherAssetKind,
} from "@/lib/other-assets/options"

export type EditableOtherAsset = {
  id: string
  kind: OtherAssetKind
  name: string
  invested: number
  currentValue: number
  valueAsOf: string
  notes: string | null
}

/** "Add asset" button, or an edit icon when an asset is passed. */
export function OtherAssetDialog({
  memberId,
  asset,
}: {
  memberId: string
  asset?: EditableOtherAsset
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {asset ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${asset.name}`}
          >
            <PencilIcon />
          </Button>
        ) : (
          <Button size="sm">
            <PlusIcon />
            Add asset
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{asset ? "Edit asset" : "Add asset"}</DialogTitle>
          <DialogDescription>
            Gold, PPF, EPF, NPS, bonds, property or anything else. Update the
            value now and then, e.g. from the PPF passbook.
          </DialogDescription>
        </DialogHeader>
        <OtherAssetForm
          memberId={memberId}
          asset={asset}
          onSaved={(message) => {
            setOpen(false)
            toast.success(message)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function OtherAssetForm({
  memberId,
  asset,
  onSaved,
}: {
  memberId: string
  asset?: EditableOtherAsset
  onSaved: (message: string) => void
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveOtherAsset(prevState, formData)
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
      {asset && <input type="hidden" name="id" value={asset.id} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="asset-kind" label="Type" error={errors.kind?.[0]}>
          {(props) => (
            <Select name="kind" defaultValue={asset?.kind ?? "gold"}>
              <SelectTrigger {...props} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OTHER_ASSET_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {OTHER_ASSET_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
        <FormField id="asset-name" label="Name" error={errors.name?.[0]}>
          {(props) => (
            <Input
              {...props}
              name="name"
              autoComplete="off"
              maxLength={80}
              placeholder="e.g. SBI PPF"
              defaultValue={asset?.name ?? ""}
              required
            />
          )}
        </FormField>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="asset-invested"
          label="Amount invested (₹)"
          hint="What was put in. 0 for gifts or inheritance."
          error={errors.invested?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="invested"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={asset ? String(asset.invested) : ""}
              required
            />
          )}
        </FormField>
        <FormField
          id="asset-value"
          label="Value now (₹)"
          error={errors.currentValue?.[0]}
        >
          {(props) => (
            <Input
              {...props}
              name="currentValue"
              inputMode="decimal"
              autoComplete="off"
              defaultValue={asset ? String(asset.currentValue) : ""}
              required
            />
          )}
        </FormField>
      </div>

      <FormField
        id="asset-as-of"
        label="Value as of"
        error={errors.valueAsOf?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            type="date"
            name="valueAsOf"
            max={today}
            defaultValue={asset?.valueAsOf ?? today}
            required
          />
        )}
      </FormField>

      <FormField id="asset-notes" label="Notes" error={errors.notes?.[0]}>
        {(props) => (
          <Textarea
            {...props}
            name="notes"
            defaultValue={asset?.notes ?? ""}
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
          {pending ? "Saving…" : asset ? "Save" : "Add asset"}
        </Button>
      </DialogFooter>
    </form>
  )
}
