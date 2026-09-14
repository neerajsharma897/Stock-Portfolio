import type { Enums } from "@/lib/supabase/database.types"

export type MemberRelation = Enums<"member_relation">
export type Broker = Enums<"broker">

// Records keep these lists in sync with the database enums: TypeScript errors if a value is missing.
export const RELATION_LABELS: Record<MemberRelation, string> = {
  self: "Self",
  spouse: "Spouse",
  son: "Son",
  daughter: "Daughter",
  father: "Father",
  mother: "Mother",
  brother: "Brother",
  sister: "Sister",
  other: "Other",
}
export const MEMBER_RELATIONS = Object.keys(RELATION_LABELS) as [
  MemberRelation,
  ...MemberRelation[],
]

export const BROKER_LABELS: Record<Broker, string> = {
  angelone: "Angel One",
  zerodha: "Zerodha",
  groww: "Groww",
  upstox: "Upstox",
  fivepaisa: "5paisa",
  coindcx: "CoinDCX",
  other: "Other",
}
export const BROKERS = Object.keys(BROKER_LABELS) as [Broker, ...Broker[]]

/** Dark enough for white initials to pass WCAG AA contrast. */
export const MEMBER_COLORS = [
  { value: "#2563eb", label: "Blue" },
  { value: "#15803d", label: "Green" },
  { value: "#dc2626", label: "Red" },
  { value: "#9333ea", label: "Purple" },
  { value: "#c2410c", label: "Orange" },
  { value: "#0e7490", label: "Teal" },
  { value: "#db2777", label: "Pink" },
  { value: "#a16207", label: "Mustard" },
] as const
export type MemberColor = (typeof MEMBER_COLORS)[number]["value"]
export const MEMBER_COLOR_VALUES = MEMBER_COLORS.map(
  (color) => color.value,
) as [MemberColor, ...MemberColor[]]

export function memberInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
  return initials || "?"
}

export function brokerAccountName(account: {
  broker: Broker
  label: string | null
}): string {
  const broker = BROKER_LABELS[account.broker]
  return account.label ? `${broker} · ${account.label}` : broker
}
