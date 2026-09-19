import type { NextRequest } from "next/server"

import { requireOwner } from "@/lib/auth"
import { financialYearOf } from "@/lib/crypto/tax"
import { todayInIndia } from "@/lib/dates"
import { buildWorkbook } from "@/lib/export/workbook"

export const maxDuration = 60

/** Excel workbook of holdings, a year's capital gains (?fy=2026 for FY 2026-27) and every entry. */
export async function GET(request: NextRequest) {
  await requireOwner()

  const fy = request.nextUrl.searchParams.get("fy")
  const year =
    fy && /^\d{4}$/.test(fy)
      ? financialYearOf(`${fy}-04-01`)
      : financialYearOf(todayInIndia())

  const workbook = await buildWorkbook(year)
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="family-portfolio-${todayInIndia()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  })
}
