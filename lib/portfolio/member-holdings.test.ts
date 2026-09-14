import { describe, expect, it } from "vitest"

import {
  groupHoldings,
  type TransactionForHolding,
} from "@/lib/portfolio/member-holdings"

function txn(
  id: string,
  brokerAccountId: string,
  instrumentId: number,
  type: TransactionForHolding["type"],
  quantity: number,
  tradeDate: string,
): TransactionForHolding {
  return {
    id,
    brokerAccountId,
    instrumentId,
    type,
    quantity,
    price: 100,
    charges: 0,
    tradeDate,
    createdAt: `${tradeDate}T10:00:00Z`,
  }
}

describe("groupHoldings", () => {
  it("keeps the same stock in different accounts as separate holdings", () => {
    const { holdings, problems } = groupHoldings([
      txn("a", "zerodha", 1, "buy", 10, "2024-01-01"),
      txn("b", "angel", 1, "buy", 5, "2024-01-01"),
      txn("c", "zerodha", 1, "sell", 4, "2024-02-01"),
      txn("d", "zerodha", 2, "opening_balance", 3, "2024-01-01"),
    ])
    expect(problems).toEqual([])
    expect(
      holdings.map((h) => [
        h.brokerAccountId,
        h.instrumentId,
        h.position.quantity,
      ]),
    ).toEqual([
      ["zerodha", 1, 6],
      ["angel", 1, 5],
      ["zerodha", 2, 3],
    ])
  })

  it("reports positions whose entries don't add up", () => {
    const { holdings, problems } = groupHoldings([
      txn("ok", "zerodha", 1, "buy", 10, "2024-01-01"),
      txn("oversell", "angel", 1, "sell", 5, "2024-01-01"),
    ])
    expect(holdings).toHaveLength(1)
    expect(problems).toMatchObject([
      { brokerAccountId: "angel", instrumentId: 1, transactionId: "oversell" },
    ])
  })
})
