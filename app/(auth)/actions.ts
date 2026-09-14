"use server"

import { redirect } from "next/navigation"
import { z } from "zod"

import { safeRedirectPath } from "@/lib/redirect"
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

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
