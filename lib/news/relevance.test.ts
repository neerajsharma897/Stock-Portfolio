import { describe, expect, it } from "vitest"

import {
  googleNewsUrl,
  isQuotePage,
  mentionsName,
  newsSearchName,
} from "@/lib/news/relevance"

describe("newsSearchName and googleNewsUrl", () => {
  it("searches the saved name, or else the symbol", () => {
    expect(newsSearchName("RELIANCE", null)).toBe("RELIANCE")
    expect(newsSearchName("RELIANCE", ' "Reliance Industries" ')).toBe(
      "Reliance Industries",
    )
  })

  it("builds an Indian English search for the past week", () => {
    const url = new URL(googleNewsUrl("HDFC Bank"))
    expect(url.origin + url.pathname).toBe("https://news.google.com/rss/search")
    expect(url.searchParams.get("q")).toBe(
      '"HDFC Bank" (share OR shares OR stock) when:7d',
    )
    expect(url.searchParams.get("ceid")).toBe("IN:en")
  })
})

describe("mentionsName", () => {
  it("matches whole words in any case, across punctuation", () => {
    expect(mentionsName("HDFC Bank's shares rise 2%", "HDFC Bank")).toBe(true)
    expect(mentionsName("Bajaj Auto sales up", "BAJAJ-AUTO")).toBe(true)
    expect(mentionsName("M&M shares hit record", "M&M")).toBe(true)
  })

  it("doesn't match inside other words", () => {
    expect(mentionsName("Supreme Court on ITC dispute", "ITC")).toBe(true)
    expect(mentionsName("Switch to new broker", "ITC")).toBe(false)
    expect(
      mentionsName("Reliance Power shares jump", "Reliance Industries"),
    ).toBe(false)
  })
})

describe("isQuotePage", () => {
  it("drops live price pages and predictions but keeps news", () => {
    for (const title of [
      "Reliance Power Share Price - Live NSE: RPOWER Stock Price & Chart",
      "Reliance Industries Share Price Prediction for Tomorrow: 11 Sep 2026",
      "Infosys Share Price Today (INFY) | Live Chart, News & Stock Market",
      "RELIANCE Outlook for the Week",
      "RELIANCE INDUSTRIES LTD Option Chain - Live Data, OI & Price",
    ]) {
      expect(isQuotePage(title)).toBe(true)
    }
    expect(
      isQuotePage(
        "HDFC Bank share price jumps over 6% in 3 days | Experts see 15% more upside",
      ),
    ).toBe(false)
  })
})
