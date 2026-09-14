import type { Metadata } from "next"

import { LoginForm } from "@/app/(auth)/login/login-form"
import { Brand } from "@/components/layout/brand"
import { SetupNotice } from "@/components/setup-notice"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { supabaseEnv } from "@/lib/env"

export const metadata: Metadata = { title: "Sign in" }

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!supabaseEnv) return <SetupNotice />

  const { next } = await searchParams

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Brand />
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Track the family&apos;s stocks, mutual funds and crypto in one
            place.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={typeof next === "string" ? next : undefined} />
        </CardContent>
      </Card>
    </main>
  )
}
