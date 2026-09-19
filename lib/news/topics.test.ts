import { describe, expect, it } from "vitest"

import { newsTopic } from "@/lib/news/topics"

describe("newsTopic", () => {
  it("labels real headlines by event", () => {
    const cases: [string, string | null][] = [
      ["Reliance Q2 Results FY27: Date, Expectations, Watchlist", "Results"],
      [
        "Dividend, Bonus Issue, Stock Split Record Dates to Mark: Reliance, Infosys",
        "Dividend",
      ],
      [
        "ITC Infotech to acquire 22.1% stake in Happiest Minds for ₹1,330 crore",
        "Deal",
      ],
      [
        "'You Harass Shareholders': Supreme Court Directs Mediation In ITC Share Dispute",
        "Regulatory",
      ],
      [
        "Atmastco Receives ₹66 Crore Order From Reliance Industries; Shares Rise 4.78%",
        "Order",
      ],
      [
        "Brokerages Maintain Buy on Reliance Industries with ₹1,750 Target",
        "Rating",
      ],
      ["Infosys shares slump over 4.5%, biggest fall in three months", null],
      ["Stocks to buy in order to beat inflation", null],
    ]
    for (const [title, topic] of cases) {
      expect(newsTopic(title), title).toBe(topic)
    }
  })
})
