import { describe, expect, it } from "vitest"

import { parseSectorCsv } from "@/lib/sectors/parse"

describe("parseSectorCsv", () => {
  it("reads symbol and industry by header, including quoted names", () => {
    const csv = [
      "﻿Company Name,Industry,Symbol,Series,ISIN Code",
      "360 ONE WAM Ltd.,Financial Services,360ONE,EQ,INE466L01038",
      '"Larsen & Toubro, Ltd.",Construction,LT,EQ,INE018A01030',
      "",
      "Broken row without industry,,XYZ,EQ,INE000000000",
    ].join("\r\n")

    expect(parseSectorCsv(csv)).toEqual([
      { symbol: "360ONE", sector: "Financial Services" },
      { symbol: "LT", sector: "Construction" },
    ])
  })

  it("returns nothing for an unexpected file", () => {
    expect(parseSectorCsv("<html>Access denied</html>")).toEqual([])
  })
})
