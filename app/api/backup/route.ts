import type { NextRequest } from "next/server"

import { buildBackup } from "@/lib/backup/export"
import { isAuthorizedCronRequest } from "@/lib/cron"
import { createAdminClient } from "@/lib/supabase/admin"

export const maxDuration = 60

/**
 * Called by the weekly GitHub backup workflow with `Authorization: Bearer <CRON_SECRET>`.
 * Returns the plain export; the workflow encrypts it before storing it.
 */
export async function GET(request: NextRequest) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      process.env.CRON_SECRET,
    )
  ) {
    return new Response("Unauthorized", { status: 401 })
  }

  const backup = await buildBackup(createAdminClient())
  return Response.json(backup, { headers: { "Cache-Control": "no-store" } })
}
