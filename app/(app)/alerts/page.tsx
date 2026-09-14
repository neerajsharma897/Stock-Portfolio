import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "Alerts" }

export default function AlertsPage() {
  return (
    <>
      <PageHeader title="Alerts" description="Telegram notifications." />
      <ComingSoon
        stage={9}
        title="Telegram alerts"
        items={[
          "Price alerts: target price, stop-loss, big daily move, 52-week high/low",
          "Daily summary at 3:45 PM on trading days",
          "System alerts when live prices or scheduled jobs fail",
        ]}
      />
    </>
  )
}
