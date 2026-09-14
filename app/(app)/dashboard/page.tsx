import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "Dashboard" }

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Family dashboard"
        description="Everyone's investments at a glance."
      />
      <ComingSoon
        stage={5}
        title="Dashboard"
        items={[
          "Family net worth and today's gain or loss",
          "Value and P&L for each member",
          "Top gainers and losers across all holdings",
          "Live prices every 5 seconds once Stage 6 is done",
        ]}
      />
    </>
  )
}
