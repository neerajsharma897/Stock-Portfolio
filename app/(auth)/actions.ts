"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { DEFAULT_AFTER_LOGIN, safeRedirectPath } from "@/lib/redirect"
import { createClient } from "@/lib/supabase/server"

const signInSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})

export type SignInState =
  | {
      email?: string
      error?: string
      fieldErrors?: { email?: string[]; password?: string[] }
    }
  | undefined

export async function signIn(
  _prevState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "")
  const parsed = signInSchema.safeParse({
    email,
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { email, fieldErrors: z.flattenError(parsed.error).fieldErrors }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return {
      email,
      error:
        error.code === "invalid_credentials"
          ? "Incorrect email or password."
          : `Couldn't sign in: ${error.message}`,
    }
  }

  redirect(safeRedirectPath(formData.get("next")))
}

export type VerifyState = { error?: string } | undefined

/** The second step of signing in: the code from the authenticator app. */
export async function verifySignIn(
  _prevState: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const code = String(formData.get("code") ?? "").trim()
  if (!/^\d{6}$/.test(code)) {
    return { error: "Enter the 6-digit code from the app." }
  }

  const supabase = await createClient()
  const { data: factors, error } = await supabase.auth.mfa.listFactors()
  if (error) return { error: `Couldn't check the code: ${error.message}` }
  const factor = factors.totp[0]
  if (!factor) redirect(DEFAULT_AFTER_LOGIN)

  const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  })
  if (verifyError) {
    return {
      error:
        verifyError.code === "mfa_verification_failed"
          ? "That code didn't match. Try the newest code in the app."
          : `Couldn't check the code: ${verifyError.message}`,
    }
  }

  redirect(DEFAULT_AFTER_LOGIN)
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
