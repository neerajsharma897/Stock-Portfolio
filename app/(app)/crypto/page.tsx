import type { Metadata } from "next"

import { ComingSoon } from "@/components/coming-soon"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "Crypto" }

export default function CryptoPage() {
  return (
    <>
      <PageHeader
        title="Crypto"
        description="Bitcoin and other coins on CoinDCX."
      />
      <ComingSoon
        stage={10}
        title="Crypto"
        items={[
          "Add crypto buys and sells",
          "Live INR prices from CoinDCX",
          "Value and P&L, with crypto tax (30% + 1% TDS) kept separate",
        ]}
      />
    </>
  )
}
