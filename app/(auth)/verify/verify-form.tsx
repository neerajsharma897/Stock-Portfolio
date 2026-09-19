"use client"

import { useActionState } from "react"

import { verifySignIn } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function VerifyForm() {
  const [state, formAction, pending] = useActionState(verifySignIn, undefined)

  return (
    <form action={formAction} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="code">Code</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          className="tracking-widest"
          aria-invalid={!!state?.error}
          aria-describedby={state?.error ? "code-error" : undefined}
          required
        />
        {state?.error && (
          <p id="code-error" role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Continue"}
      </Button>
    </form>
  )
}
