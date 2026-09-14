import { AppShell } from "@/components/layout/app-shell"
import { NoAccess } from "@/components/no-access"
import { isOwner, requireUser } from "@/lib/auth"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireUser()
  if (!(await isOwner())) return <NoAccess email={user.email} />

  return <AppShell email={user.email}>{children}</AppShell>
}
