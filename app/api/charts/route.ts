import type { NextRequest } from "next/server"

import { requireOwner } from "@/lib/auth"
import { isChartRange } from "@/lib/charts/candles"
import { ChartUnavailableError, getChart } from "@/lib/charts/fetch"

/** Price history for a stock chart: /api/charts?instrument=123&range=1M */
export async function GET(request: NextRequest) {
  await requireOwner()

  const params = request.nextUrl.searchParams
  const instrumentId = Number(params.get("instrument"))
  const range = params.get("range")
  if (
    !Number.isInteger(instrumentId) ||
    instrumentId <= 0 ||
    !isChartRange(range)
  ) {
    return Response.json(
      { error: "Choose a stock and a time range." },
      { status: 400 },
    )
  }

  try {
    return Response.json(await getChart(instrumentId, range), {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Couldn't load the chart.",
      },
      { status: error instanceof ChartUnavailableError ? 503 : 502 },
    )
  }
}
