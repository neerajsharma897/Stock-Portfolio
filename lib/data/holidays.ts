import "server-only"

import { requireOwner } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import type { AppSupabaseClient } from "@/lib/supabase/types"

export type MarketHoliday = { date: string; description: string }

/** Market holidays, oldest first. Pass `from` (YYYY-MM-DD) to skip past ones. */
export async function listMarketHolidays(
  options: { from?: string } = {},
): Promise<MarketHoliday[]> {
  await requireOwner()
  return fetchMarketHolidays(await createClient(), options)
}

/** Same as listMarketHolidays, with any client (scheduled jobs use the admin client). */
export async function fetchMarketHolidays(
  supabase: AppSupabaseClient,
  { from }: { from?: string } = {},
): Promise<MarketHoliday[]> {
  let query = supabase
    .from("market_holidays")
    .select("holiday_date, description")
    .order("holiday_date")
  if (from) query = query.gte("holiday_date", from)

  const { data, error } = await query
  if (error) throw new Error(`Couldn't load market holidays: ${error.message}`)
  return data.map((row) => ({
    date: row.holiday_date,
    description: row.description,
  }))
}
