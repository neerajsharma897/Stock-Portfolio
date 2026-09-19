"use client"

import { ShieldCheckIcon, ShieldIcon } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import {
  confirmMfaEnrollment,
  disableMfa,
  startMfaEnrollment,
  type MfaEnrollment,
} from "@/app/(app)/settings/mfa-actions"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { showResult } from "@/lib/show-result"

/** Turns two-step sign-in (an authenticator app code after the password) on or off. */
export function MfaCard({ enabled }: { enabled: boolean }) {
  const [setup, setSetup] = useState<MfaEnrollment | null>(null)
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (enabled) {
    return (
      <div className="grid gap-3">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheckIcon className="size-4 text-gain" aria-hidden />
          On: signing in needs a code from the authenticator app.
        </p>
        <ConfirmDialog
          trigger={
            <Button variant="outline" size="sm" className="w-fit">
              Turn off
            </Button>
          }
          title="Turn off two-step sign-in?"
          description="Anyone with the password could then sign in and see the family's investments."
          confirmLabel="Turn off"
          destructive
          onConfirm={async () => showResult(await disableMfa())}
        />
      </div>
    )
  }

  if (setup?.status === "ready") {
    const confirm = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      startTransition(async () => {
        const result = await confirmMfaEnrollment(setup.factorId, code)
        if (result?.status === "success") {
          toast.success(result.message)
          setSetup(null)
        } else {
          setError(result?.message ?? "Couldn't turn it on.")
        }
      })
    }

    return (
      <form onSubmit={confirm} className="grid gap-4" noValidate>
        <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
          <li>
            Open an authenticator app (Google Authenticator, Microsoft
            Authenticator or similar) and add an account.
          </li>
          <li>Scan this QR code, or type the key below it.</li>
          <li>Enter the 6-digit code the app shows.</li>
        </ol>
        {/* The QR code is an SVG data URL from Supabase, so next/image isn't needed. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={setup.qrCode}
          alt="QR code for the authenticator app"
          className="size-44 rounded-lg bg-white p-2"
        />
        <p className="text-xs text-muted-foreground">
          Key:{" "}
          <code className="font-mono break-all text-foreground select-all">
            {setup.secret}
          </code>
        </p>
        <FormField
          id="mfa-code"
          label="Code from the app"
          error={error ?? undefined}
        >
          {(props) => (
            <Input
              {...props}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="w-32 tracking-widest"
            />
          )}
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Checking…" : "Turn on"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              setSetup(null)
              setCode("")
              setError(null)
            }}
          >
            Cancel
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="grid gap-3">
      <p className="flex items-center gap-2 text-sm">
        <ShieldIcon className="size-4 text-muted-foreground" aria-hidden />
        Off: the password alone signs in.
      </p>
      <p className="text-sm text-muted-foreground">
        With it on, signing in also needs a code from an authenticator app on
        the phone, and the database refuses a session without it.
      </p>
      {setup?.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {setup.message}
        </p>
      )}
      <Button
        className="w-fit"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null)
            setCode("")
            setSetup(await startMfaEnrollment())
          })
        }
      >
        {pending ? "Starting…" : "Turn on two-step sign-in"}
      </Button>
    </div>
  )
}
