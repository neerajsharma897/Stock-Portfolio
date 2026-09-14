import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export type Tone = "gain" | "loss" | "neutral"

/** Direction of a rupee amount, ignoring anything under 50 paise. */
export function toneOf(value: number | null | undefined): Tone {
  if (value === null || value === undefined || Math.round(value) === 0) {
    return "neutral"
  }
  return value > 0 ? "gain" : "loss"
}

export function toneTextClass(tone: Tone) {
  return tone === "gain"
    ? "text-gain"
    : tone === "loss"
      ? "text-loss"
      : "text-muted-foreground"
}

/**
 * A headline number. `hero` is the one number a page leads with (48px).
 * Deltas carry a +/− sign, so direction never relies on colour alone.
 */
export function StatTile({
  label,
  value,
  delta,
  tone = "neutral",
  hint,
  hero = false,
  className,
}: {
  label: string
  value: string
  delta?: string
  tone?: Tone
  hint?: string
  hero?: boolean
  className?: string
}) {
  return (
    <Card className={className}>
      <CardContent className="grid content-start gap-1">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={cn(
            "font-semibold tracking-tight break-words",
            hero ? "text-5xl" : "text-2xl",
          )}
        >
          {value}
        </p>
        {delta && (
          <p className={cn("text-sm font-medium", toneTextClass(tone))}>
            {delta}
          </p>
        )}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}
