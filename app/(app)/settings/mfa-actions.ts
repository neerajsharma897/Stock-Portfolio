"use server"

import { refresh } from "next/cache"

import { actionError, type FormState } from "@/lib/action-state"
import { requireOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type MfaEnrollment =
  | { status: "ready"; factorId: string; qrCode: string; secret: string }
  | { status: "error"; message: string }

const CODE = /^\d{6}$/

/** Starts adding an authenticator app: returns the QR code and secret to scan. */
export async function startMfaEnrollment(): Promise<MfaEnrollment> {
  await requireOwner()
  const supabase = await createClient()

  const { data: factors, error: listError } =
    await supabase.auth.mfa.listFactors()
  if (listError) return { status: "error", message: listError.message }
  if (factors.totp.length > 0) {
    return { status: "error", message: "Two-step sign-in is already on." }
  }
  // A half-finished setup from before would clash with the new one.
  for (const factor of factors.all) {
    if (factor.factor_type === "totp" && factor.status !== "verified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Family Portfolio",
  })
  if (error) {
    return {
      status: "error",
      message: `Couldn't start: ${error.message}. Check that TOTP is enabled in Supabase (Authentication → Multi-Factor).`,
    }
  }
  return {
    status: "ready",
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

/** Finishes setup with the first code from the authenticator app. */
export async function confirmMfaEnrollment(
  factorId: string,
  code: string,
): Promise<FormState> {
  await requireOwner()
  if (!CODE.test(code.trim())) {
    return actionError("Enter the 6-digit code from the app.")
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: code.trim(),
  })
  if (error) {
    return actionError(
      error.code === "mfa_verification_failed"
        ? "That code didn't match. Check the phone's time is set automatically, then try the newest code."
        : `Couldn't turn it on: ${error.message}`,
    )
  }

  refresh()
  return {
    status: "success",
    message:
      "Two-step sign-in is on. You'll need a code from the app each time you sign in.",
  }
}

/** Removes the authenticator app, so only the password is needed again. */
export async function disableMfa(): Promise<FormState> {
  await requireOwner()
  const supabase = await createClient()

  const { data: factors, error } = await supabase.auth.mfa.listFactors()
  if (error) return actionError(`Couldn't turn it off: ${error.message}`)
  for (const factor of factors.all) {
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({
      factorId: factor.id,
    })
    if (unenrollError) {
      return actionError(`Couldn't turn it off: ${unenrollError.message}`)
    }
  }

  refresh()
  return { status: "success", message: "Two-step sign-in is off." }
}
