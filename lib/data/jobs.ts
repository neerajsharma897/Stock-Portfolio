import "server-only"

import { requireOwner } from "@/lib/auth"
import { JOB_NAMES, type JobName } from "@/lib/jobs/names"
import type { Enums } from "@/lib/supabase/database.types"
import { createClient } from "@/lib/supabase/server"

export type JobRun = {
  status: Enums<"job_status">
  summary: string | null
  error: string | null
  startedAt: string
  finishedAt: string | null
}

/** The most recent run of each scheduled job, or null if it hasn't run yet. */
export async function listLatestJobRuns(): Promise<
  Record<JobName, JobRun | null>
> {
  await requireOwner()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("job_runs")
    .select("job, status, summary, error, started_at, finished_at")
    .order("started_at", { ascending: false })
    .limit(50)
  if (error) throw new Error(`Couldn't load job runs: ${error.message}`)

  const latest = Object.fromEntries(
    JOB_NAMES.map((job) => [job, null]),
  ) as Record<JobName, JobRun | null>
  for (const row of data) {
    const job = row.job as JobName
    if (!(job in latest) || latest[job]) continue
    latest[job] = {
      status: row.status,
      summary: row.summary,
      error: row.error,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    }
  }
  return latest
}
