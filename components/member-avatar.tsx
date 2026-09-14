import { memberInitials } from "@/lib/members/options"
import { cn } from "@/lib/utils"

export function MemberAvatar({
  name,
  color,
  size = "md",
}: {
  name: string
  color: string
  size?: "md" | "lg"
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "lg" ? "size-14 text-lg" : "size-10 text-sm",
      )}
      style={{ backgroundColor: color }}
    >
      {memberInitials(name)}
    </span>
  )
}
