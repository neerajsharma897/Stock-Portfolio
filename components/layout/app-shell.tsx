import { Brand } from "@/components/layout/brand"
import { MobileNav } from "@/components/layout/mobile-nav"
import { NavLinks } from "@/components/layout/nav-links"
import { UserMenu } from "@/components/layout/user-menu"

/**
 * Angel One-style layout: a full-width top bar, then floating rounded panels
 * on the page background with an 8px gutter between everything.
 */
export function AppShell({
  email,
  children,
}: {
  email: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-card px-4 dark:border-b-0">
        <MobileNav />
        <Brand />
        <div className="flex-1" />
        <UserMenu email={email} />
      </header>

      <div className="flex gap-2 p-2">
        {/* Sticks 8px below the 56px top bar and stops 8px above the bottom. */}
        <aside className="sticky top-16 hidden h-[calc(100svh-4.5rem)] w-56 shrink-0 flex-col rounded-xl bg-sidebar p-2 ring-1 ring-border md:flex dark:ring-0">
          <NavLinks />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
