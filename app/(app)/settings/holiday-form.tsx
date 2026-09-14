"use client"

import { PlusIcon } from "lucide-react"
import { startTransition, useActionState, useRef } from "react"
import { toast } from "sonner"

import { saveMarketHoliday } from "@/app/(app)/settings/actions"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FormState } from "@/lib/action-state"

export function HolidayForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveMarketHoliday(prevState, formData)
      if (result?.status === "success") {
        toast.success(result.message)
        formRef.current?.reset()
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
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start"
      noValidate
    >
      <FormField id="holiday-date" label="Date" error={errors.date?.[0]}>
        {(props) => <Input {...props} type="date" name="date" required />}
      </FormField>
      <FormField
        id="holiday-description"
        label="Holiday"
        error={errors.description?.[0]}
      >
        {(props) => (
          <Input
            {...props}
            name="description"
            maxLength={80}
            autoComplete="off"
            placeholder="e.g. Diwali Laxmi Pujan"
            required
          />
        )}
      </FormField>
      <Button type="submit" disabled={pending} className="sm:mt-6">
        <PlusIcon />
        {pending ? "Adding…" : "Add"}
      </Button>
      {state?.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive sm:col-span-3">
          {state.message}
        </p>
      )}
    </form>
  )
}
