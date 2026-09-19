import { describe, expect, it } from "vitest"

import { watchlistItemSchema, watchlistSchema } from "@/lib/watchlist/schema"

describe("watchlistSchema", () => {
  it("trims names and rejects blank or long ones", () => {
    expect(watchlistSchema.parse({ name: "  Banks " })).toEqual({
      name: "Banks",
    })
    expect(watchlistSchema.safeParse({ name: "   " }).success).toBe(false)
    expect(watchlistSchema.safeParse({ name: "x".repeat(41) }).success).toBe(
      false,
    )
  })
})

describe("watchlistItemSchema", () => {
  it("reads the form with an optional note", () => {
    expect(
      watchlistItemSchema.parse({
        watchlistId: "8e6b7f9d-0abc-4d24-9ef0-5b6c7d8e9fa0",
        instrumentId: "2885",
        note: " ",
      }),
    ).toEqual({
      watchlistId: "8e6b7f9d-0abc-4d24-9ef0-5b6c7d8e9fa0",
      instrumentId: 2885,
      note: null,
    })
  })
})
