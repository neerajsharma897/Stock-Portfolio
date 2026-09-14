import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "Members" }

export default function MembersPage() {
  return (
    <>
      <PageHeader
        title="Members"
        description="Family members whose investments you track."
      />
      <ComingSoon
        stage={2}
        title="Members & broker accounts"
        items={[
          "Add, edit and archive family members",
          "Link each member's accounts: Angel One, Zerodha, Groww, Upstox, 5paisa, CoinDCX",
          "Open a member to see their holdings (Stages 4–5)",
        ]}
      />
    </>
  )
}
