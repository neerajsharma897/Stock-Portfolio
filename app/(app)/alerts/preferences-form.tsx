"use client"

import { startTransition, useActionState } from "react"
import { toast } from "sonner"

import { saveAlertPreferences } from "@/app/(app)/alerts/actions"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { FormState } from "@/lib/action-state"

export function PreferencesForm({
  dailySummary,
  systemAlerts,
  quietStart,
  quietEnd,
}: {
  dailySummary: boolean
  systemAlerts: boolean
  /** "HH:MM" */
  quietStart: string
  quietEnd: string
}) {
  const [state, formAction, pending] = useActionState(
    async (prevState: FormState, formData: FormData) => {
      const result = await saveAlertPreferences(prevState, formData)
      if (result?.status === "success") toast.success(result.message)
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
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="dailySummary"
          defaultChecked={dailySummary}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Daily summary after the close</span>
          <span className="block text-muted-foreground">
            Family and member values, today&apos;s change and top movers, on
            trading days.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="systemAlerts"
          defaultChecked={systemAlerts}
          className="mt-0.5 size-4 accent-primary"
        />
        <span>
          <span className="font-medium">Problems</span>
          <span className="block text-muted-foreground">
            A scheduled job failed, or the Angel One login stopped working. At
            most once a day each.
          </span>
        </span>
      </label>

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Quiet hours</legend>
        <p className="text-xs text-muted-foreground">
          Nothing is sent between these times (India time); those alerts are
          listed below as held back. Use the same time twice for none.
        </p>
        <div className="grid grid-cols-2 gap-4 sm:max-w-xs">
          <FormField
            id="quiet-start"
            label="From"
            error={errors.quietStart?.[0]}
          >
            {(props) => (
              <Input
                {...props}
                type="time"
                name="quietStart"
                defaultValue={quietStart}
              />
            )}
          </FormField>
          <FormField id="quiet-end" label="Until" error={errors.quietEnd?.[0]}>
            {(props) => (
              <Input
                {...props}
                type="time"
                name="quietEnd"
                defaultValue={quietEnd}
              />
            )}
          </FormField>
        </div>
      </fieldset>

      {state?.status === "error" && state.message && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Button type="submit" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  )
}
