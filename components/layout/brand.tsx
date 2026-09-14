import { WalletIcon } from "lucide-react"
import Link from "next/link"

export function Brand() {
  return (
    <Link
      href="/dashboard"
      className="flex items-center gap-2 font-semibold tracking-tight"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <WalletIcon className="size-4" aria-hidden />
      </span>
      Family Portfolio
    </Link>
  )
}
