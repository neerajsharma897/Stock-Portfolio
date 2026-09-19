import { redirect } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { NoAccess } from "@/components/no-access"
import { ownerAccess, requireUser } from "@/lib/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  const access = await ownerAccess()
  if (access === "needs_mfa") redirect("/verify")
  if (access !== "owner") return <NoAccess email={user.email} />

  return <AppShell email={user.email}>{children}</AppShell>
}
