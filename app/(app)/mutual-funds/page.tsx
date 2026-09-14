import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "Mutual funds" }

export default function MutualFundsPage() {
  return (
    <>
      <PageHeader
        title="Mutual funds"
        description="Funds and SIPs across every platform."
      />
      <ComingSoon
        stage={8}
        title="Mutual funds"
        items={[
          "Import funds from each member's CAMS/KFintech CAS PDF",
          "Daily NAV from AMFI, with value, returns and XIRR",
          "SIP list and upcoming SIP dates",
          "Flag Regular plans that cost extra commission",
        ]}
      />
    </>
  )
}
