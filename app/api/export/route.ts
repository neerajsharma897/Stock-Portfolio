import { requireOwner } from "@/lib/auth"
import { buildBackup } from "@/lib/backup/export"
import { todayInIndia } from "@/lib/dates"
import { createClient } from "@/lib/supabase/server"

export const maxDuration = 60

/** "Download data" in Settings: everything the owner entered, as a JSON file. */
export async function GET() {
  await requireOwner()

  const backup = await buildBackup(await createClient())
  return new Response(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="family-portfolio-${todayInIndia()}.json"`,
      "Cache-Control": "no-store",
    },
  })
}
