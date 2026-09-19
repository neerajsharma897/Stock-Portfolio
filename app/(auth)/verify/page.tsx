import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { signOut } from "@/app/(auth)/actions"
import { VerifyForm } from "@/app/(auth)/verify/verify-form"
import { Brand } from "@/components/layout/brand"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { getCurrentUser, ownerAccess } from "@/lib/auth"

export const metadata: Metadata = { title: "Enter code" }

export default async function VerifyPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/login")
  if ((await ownerAccess()) !== "needs_mfa") redirect("/dashboard")

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Brand />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Two-step sign-in</CardTitle>
          <CardDescription>
            Enter the 6-digit code from the authenticator app for {user.email}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <VerifyForm />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm" className="w-full">
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
