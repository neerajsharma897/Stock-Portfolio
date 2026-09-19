import type { Enums } from "@/lib/supabase/database.types"

export type FdInterest = Enums<"fd_interest">
export type OtherAssetKind = Enums<"other_asset_kind">
export type IpoStatus = Enums<"ipo_status">

export const FD_INTEREST_LABELS: Record<FdInterest, string> = {
  quarterly: "Compounded quarterly",
  monthly: "Compounded monthly",
  half_yearly: "Compounded half-yearly",
  yearly: "Compounded yearly",
  payout: "Interest paid out",
}
export const FD_INTERESTS = Object.keys(FD_INTEREST_LABELS) as [
  FdInterest,
  ...FdInterest[],
]

export const OTHER_ASSET_LABELS: Record<OtherAssetKind, string> = {
  gold: "Gold",
  silver: "Silver",
  ppf: "PPF",
  epf: "EPF",
  nps: "NPS",
  bond: "Bonds",
  real_estate: "Property",
  other: "Other",
}
export const OTHER_ASSET_KINDS = Object.keys(OTHER_ASSET_LABELS) as [
  OtherAssetKind,
  ...OtherAssetKind[],
]

export const IPO_STATUS_LABELS: Record<IpoStatus, string> = {
  applied: "Applied",
  allotted: "Allotted",
  not_allotted: "Not allotted",
  withdrawn: "Withdrawn",
}
export const IPO_STATUSES = Object.keys(IPO_STATUS_LABELS) as [
  IpoStatus,
  ...IpoStatus[],
]
