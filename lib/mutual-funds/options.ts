import type { TransactionType } from "@/lib/portfolio/holdings"
import type { Enums } from "@/lib/supabase/database.types"

export type MfTransactionType = Enums<"mf_transaction_type">
export type MfPlan = Enums<"mf_plan">
export type MfOption = Enums<"mf_option">

export const MF_TRANSACTION_LABELS: Record<MfTransactionType, string> = {
  opening_balance: "Opening balance",
  purchase: "Purchase",
  sip: "SIP instalment",
  redemption: "Redemption",
}

export const MF_TRANSACTION_TYPES = Object.keys(MF_TRANSACTION_LABELS) as [
  MfTransactionType,
  ...MfTransactionType[],
]

export const MF_PLAN_LABELS: Record<MfPlan, string> = {
  direct: "Direct",
  regular: "Regular",
}

export const MF_OPTION_LABELS: Record<MfOption, string> = {
  growth: "Growth",
  idcw: "IDCW",
}

type PlanDetails = {
  plan: MfPlan | null
  option_type: MfOption | null
  option_label: string | null
}

// Some AMFI option names run to 80+ characters.
const MAX_OPTION_LABEL = 30

/** "Growth", or AMFI's wording for IDCW variants, e.g. "Monthly IDCW Payout". */
export function fundOptionLabel(fund: PlanDetails): string | null {
  if (fund.option_type === "growth") return MF_OPTION_LABELS.growth
  if (fund.option_label && fund.option_label.length <= MAX_OPTION_LABEL) {
    return fund.option_label
  }
  return fund.option_type ? MF_OPTION_LABELS[fund.option_type] : null
}

/** "Direct · Growth", or whatever part AMFI provides. */
export function describeFundPlan(fund: PlanDetails): string {
  return [fund.plan ? MF_PLAN_LABELS[fund.plan] : null, fundOptionLabel(fund)]
    .filter(Boolean)
    .join(" · ")
}

/** Fund entries map onto the holdings engine: purchases and SIPs buy units, redemptions sell. */
export function toHoldingType(type: MfTransactionType): TransactionType {
  if (type === "opening_balance") return "opening_balance"
  return type === "redemption" ? "sell" : "buy"
}
