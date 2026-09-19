import "server-only"

import { requireOwner } from "@/lib/auth"
import { describeAuditEntry } from "@/lib/audit/describe"
import { createClient } from "@/lib/supabase/server"

export type RecentChange = {
  id: number
  changedAt: string
  description: string
}

/** The latest changes to family data, newest first. */
export async function listRecentChanges(limit = 30): Promise<RecentChange[]> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("audit_log")
    .select("id, table_name, action, old_data, new_data, changed_at")
    .order("changed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit)
  if (error) throw new Error(`Couldn't load recent changes: ${error.message}`)

  return data.map((entry) => ({
    id: entry.id,
    changedAt: entry.changed_at,
    description: describeAuditEntry(entry),
  }))
}
