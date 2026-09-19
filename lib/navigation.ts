import {
  BellIcon,
  ChartPieIcon,
  CoinsIcon,
  EyeIcon,
  LayoutDashboardIcon,
  NewspaperIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { href: string; label: string; icon: LucideIcon }

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/members", label: "Members", icon: UsersIcon },
  { href: "/mutual-funds", label: "Mutual funds", icon: ChartPieIcon },
  { href: "/crypto", label: "Crypto", icon: CoinsIcon },
  { href: "/watchlist", label: "Watchlists", icon: EyeIcon },
  { href: "/news", label: "News", icon: NewspaperIcon },
  { href: "/alerts", label: "Alerts", icon: BellIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
]
